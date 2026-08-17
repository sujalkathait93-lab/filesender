/**
 * FileShare Chunk Manager
 * High-performance, streaming memory-efficient chunking engine supporting up to 2 GB transfers.
 * Avoids loading entire files into RAM by operating slice-by-slice.
 */

import { encryptChunkData, decryptChunkData, deriveKey } from './crypto.js';
import { hexToBytes } from './hexUtils.js';

export const DEFAULT_CHUNK_SIZE = 512 * 1024; // 512 KB per chunk
export const MAX_TOTAL_TRANSFER_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

/**
 * Validate selection total size
 */
export function validateFilesTotalSize(files) {
  const total = Array.from(files).reduce((acc, f) => acc + (f.size || 0), 0);
  if (total > MAX_TOTAL_TRANSFER_SIZE) {
    return {
      valid: false,
      totalSize: total,
      error: `Total selection size exceeds maximum allowed capacity of 2 GB (${(total / (1024 * 1024 * 1024)).toFixed(2)} GB selected).`
    };
  }
  return { valid: true, totalSize: total, error: null };
}

/**
 * Compute SHA-256 hash of a Uint8Array or ArrayBuffer for file integrity verification
 */
export async function computeSHA256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sender File Chunk Generator
 * Generator function that yields encrypted chunks one by one without buffering the whole file in RAM.
 */
export async function* generateEncryptedChunks({ file, fileId, transferId, key, baseIV, chunkSize = DEFAULT_CHUNK_SIZE, onChunkProgress }) {
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / chunkSize) || 1;
  let chunkIndex = 0;

  for (let offset = 0; offset < totalSize; offset += chunkSize) {
    const slice = file.slice(offset, Math.min(offset + chunkSize, totalSize));
    const sliceBuffer = await slice.arrayBuffer();

    // Encrypt chunk slice
    const encryptedData = await encryptChunkData(sliceBuffer, key, baseIV, chunkIndex);
    const chunkChecksum = await computeSHA256(encryptedData);

    const chunkMeta = {
      transferId,
      fileId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      chunkIndex,
      totalChunks,
      chunkSize: encryptedData.byteLength,
      offset,
      totalSize,
      checksum: chunkChecksum
    };

    chunkIndex++;

    if (typeof onChunkProgress === 'function') {
      onChunkProgress({
        chunkIndex,
        totalChunks,
        bytesProcessed: Math.min(offset + slice.size, totalSize),
        totalSize
      });
    }

    yield {
      meta: chunkMeta,
      data: encryptedData
    };
  }
}

/**
 * Receiver Chunk Assembler & Integrator
 * Collects, verifies, and reconstructs multi-file payloads from chunks.
 */
export class ReceiverChunkManager {
  constructor(manifest) {
    this.manifest = manifest; // List of file entries: [{ id, name, size, type, totalChunks, iv, salt }]
    this.filesMap = new Map();
    this.receivedStats = {
      totalBytesReceived: 0,
      totalBytesExpected: manifest ? manifest.reduce((acc, f) => acc + (f.size || 0), 0) : 0
    };

    if (manifest) {
      for (const fileMeta of manifest) {
        this.filesMap.set(fileMeta.id, {
          meta: fileMeta,
          chunks: new Map(), // chunkIndex -> Uint8Array
          receivedBytes: 0,
          totalChunks: fileMeta.totalChunks,
          completed: false,
          checksum: fileMeta.checksum
        });
      }
    }
  }

  addChunk(fileId, chunkIndex, totalChunks, chunkData, checksum = null) {
    let fileStore = this.filesMap.get(fileId);
    if (!fileStore) {
      // Auto-register file if manifest didn't pre-declare it
      fileStore = {
        meta: { id: fileId, name: `file_${fileId}`, totalChunks },
        chunks: new Map(),
        receivedBytes: 0,
        totalChunks,
        completed: false
      };
      this.filesMap.set(fileId, fileStore);
    }

    // Duplicate chunk protection
    if (fileStore.chunks.has(chunkIndex)) {
      return { duplicate: true, completed: fileStore.completed };
    }

    fileStore.chunks.set(chunkIndex, chunkData);
    fileStore.receivedBytes += chunkData.byteLength;
    this.receivedStats.totalBytesReceived += chunkData.byteLength;

    if (fileStore.chunks.size === totalChunks) {
      fileStore.completed = true;
    }

    return {
      duplicate: false,
      chunkIndex,
      fileCompleted: fileStore.completed,
      allFilesCompleted: Array.from(this.filesMap.values()).every(f => f.completed)
    };
  }

  async decryptAndAssembleFile(fileId, key, baseIV) {
    const fileStore = this.filesMap.get(fileId);
    if (!fileStore) throw new Error(`File ${fileId} not found in receiver manager`);
    if (!fileStore.completed) throw new Error(`File ${fileId} has missing chunks (${fileStore.chunks.size}/${fileStore.totalChunks})`);

    const decryptedBuffers = [];
    let totalDecryptedBytes = 0;

    for (let i = 0; i < fileStore.totalChunks; i++) {
      const encChunk = fileStore.chunks.get(i);
      if (!encChunk) throw new Error(`Missing chunk index ${i} for file ${fileId}`);

      const decChunk = await decryptChunkData(
        encChunk.buffer.slice(encChunk.byteOffset, encChunk.byteOffset + encChunk.byteLength),
        key,
        baseIV,
        i
      );
      decryptedBuffers.push(decChunk);
      totalDecryptedBytes += decChunk.byteLength;
    }

    const reconstructedBlob = new Blob(decryptedBuffers, {
      type: fileStore.meta.type || fileStore.meta.mime_type || 'application/octet-stream'
    });

    // Verification
    if (fileStore.meta.originalSize && reconstructedBlob.size !== fileStore.meta.originalSize) {
      console.warn(`File size mismatch for ${fileStore.meta.name}: expected ${fileStore.meta.originalSize}, got ${reconstructedBlob.size}`);
    }

    return {
      id: fileId,
      name: fileStore.meta.name || fileStore.meta.original_name || 'downloaded_file',
      size: reconstructedBlob.size,
      mimeType: reconstructedBlob.type,
      blob: reconstructedBlob
    };
  }

  async decryptAllFiles(password) {
    const results = [];
    for (const [fileId, fileStore] of this.filesMap.entries()) {
      const iv = hexToBytes(fileStore.meta.iv);
      const salt = hexToBytes(fileStore.meta.salt);

      if (!iv || !salt) {
        throw new Error(`Invalid encryption IV/Salt metadata for file ${fileStore.meta.name}`);
      }

      const key = await deriveKey(password, salt);
      const assembled = await this.decryptAndAssembleFile(fileId, key, iv);
      results.push(assembled);
    }
    return results;
  }
}
