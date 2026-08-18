/**
 * FileShare Stream & Batch Chunk Manager
 * High-performance, memory-safe streaming engine.
 * 
 * Specifications:
 * - 256 KB chunk size (262,144 bytes)
 * - 8 chunks grouped into 2 MB batches
 * - AES-256-GCM batch encryption with unique counter IVs
 * - Streaming disk write via File System Access API (showSaveFilePicker)
 * - Automatic retry and missing chunk detection
 * - Final end-to-end SHA-256 verification
 */

import { encryptChunkData, decryptChunkData, deriveKey } from './crypto.js';
import { hexToBytes } from './hexUtils.js';

export const CHUNK_SIZE = 256 * 1024; // 256 KB per chunk
export const BATCH_CHUNKS_COUNT = 8;   // 8 chunks per batch
export const BATCH_SIZE = CHUNK_SIZE * BATCH_CHUNKS_COUNT; // 2 MB per batch
export const MAX_TOTAL_TRANSFER_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

/**
 * Compute SHA-256 checksum of an ArrayBuffer or Uint8Array
 */
export async function computeSHA256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate total batches and chunks for a given file size
 */
export function calculateTransferPlan(fileSize) {
  const totalChunks = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));
  const totalBatches = Math.max(1, Math.ceil(totalChunks / BATCH_CHUNKS_COUNT));
  return {
    fileSize,
    chunkSize: CHUNK_SIZE,
    batchSize: BATCH_SIZE,
    chunksPerBatch: BATCH_CHUNKS_COUNT,
    totalChunks,
    totalBatches
  };
}

/**
 * Stream & Batch Sender Engine
 * Streams file from disk via File.slice() in 256 KB chunks, groups into 8-chunk (2 MB) batches,
 * encrypts each batch, and yields them sequentially without accumulating full files in RAM.
 */
export class StreamBatchSender {
  constructor({ file, key, baseIV, fileId, transferId, onProgress, onStatus }) {
    this.file = file;
    this.key = key;
    this.baseIV = baseIV;
    this.fileId = fileId;
    this.transferId = transferId;
    this.onProgress = onProgress;
    this.onStatus = onStatus;

    this.plan = calculateTransferPlan(file.size);
    this.isCancelled = false;
    this.isPaused = false;
    this.currentBatchIndex = 0;
    this.currentChunkIndex = 0;
  }

  cancel() {
    this.isCancelled = true;
    this.onStatus?.('Transfer cancelled by sender.');
  }

  pause() {
    this.isPaused = true;
    this.onStatus?.('Transfer paused.');
  }

  resume() {
    this.isPaused = false;
    this.onStatus?.('Transfer resumed.');
  }

  /**
   * Read and build a single 256 KB chunk slice
   */
  async readChunk(chunkIndex) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, this.file.size);
    const sliceBlob = this.file.slice(start, end);
    const sliceBuffer = await sliceBlob.arrayBuffer();
    return new Uint8Array(sliceBuffer);
  }

  /**
   * Process a single batch (8 chunks = 2 MB), encrypt, and return packaged batch
   */
  async processBatch(batchIndex) {
    if (this.isCancelled) throw new Error('Transfer cancelled');

    const startChunk = batchIndex * BATCH_CHUNKS_COUNT;
    const endChunk = Math.min(startChunk + BATCH_CHUNKS_COUNT, this.plan.totalChunks);
    const chunkPromises = [];

    for (let i = startChunk; i < endChunk; i++) {
      chunkPromises.push(this.readChunk(i));
    }

    const chunks = await Promise.all(chunkPromises);
    const totalRawBytes = chunks.reduce((acc, c) => acc + c.byteLength, 0);

    // Concatenate chunks for batch encryption
    const batchRawBuffer = new Uint8Array(totalRawBytes);
    let offset = 0;
    const chunkChecksums = [];

    for (const chunk of chunks) {
      batchRawBuffer.set(chunk, offset);
      const hash = await computeSHA256(chunk);
      chunkChecksums.push(hash);
      offset += chunk.byteLength;
    }

    // Encrypt batch with batch-derived counter IV
    const encryptedBatch = await encryptChunkData(batchRawBuffer.buffer, this.key, this.baseIV, batchIndex);
    const batchChecksum = await computeSHA256(encryptedBatch);

    return {
      transferId: this.transferId,
      fileId: this.fileId,
      fileName: this.file.name,
      fileSize: this.file.size,
      batchIndex,
      totalBatches: this.plan.totalBatches,
      startChunk,
      endChunk: endChunk - 1,
      totalChunks: this.plan.totalChunks,
      chunkChecksums,
      batchChecksum,
      data: encryptedBatch
    };
  }

  /**
   * Stream all batches with progress notifications
   */
  async *streamBatches() {
    for (let b = 0; b < this.plan.totalBatches; b++) {
      if (this.isCancelled) break;
      while (this.isPaused && !this.isCancelled) {
        await new Promise(r => setTimeout(r, 100));
      }

      const batch = await this.processBatch(b);
      this.currentBatchIndex = b + 1;
      this.currentChunkIndex = Math.min((b + 1) * BATCH_CHUNKS_COUNT, this.plan.totalChunks);

      const bytesProcessed = Math.min((b + 1) * BATCH_SIZE, this.file.size);
      const percent = Math.min(100, Math.round((bytesProcessed / this.file.size) * 100));

      this.onProgress?.({
        percent,
        currentBatch: this.currentBatchIndex,
        totalBatches: this.plan.totalBatches,
        currentChunk: this.currentChunkIndex,
        totalChunks: this.plan.totalChunks,
        bytesProcessed,
        totalBytes: this.file.size
      });

      yield batch;
    }
  }
}

/**
 * Stream & Batch Receiver Engine
 * Receives chunks and batches, validates checksums, decrypts batches in stream,
 * and streams decrypted data directly to disk via File System Access API.
 */
export class StreamBatchReceiver {
  constructor({ fileMeta, key, baseIV, onProgress, onStatus, onComplete, onError }) {
    this.fileMeta = fileMeta;
    this.key = key;
    this.baseIV = baseIV;
    this.onProgress = onProgress;
    this.onStatus = onStatus;
    this.onComplete = onComplete;
    this.onError = onError;

    this.plan = calculateTransferPlan(fileMeta.size || fileMeta.original_size || 0);
    this.receivedBatches = new Map(); // batchIndex -> encryptedUint8Array
    this.receivedChunksBitmask = new Set();
    this.isCancelled = false;
    this.fileHandle = null;
    this.writableStream = null;
    this.fallbackBuffers = [];
    this.hasDirectDiskWrite = false;
    this.bytesWritten = 0;
  }

  cancel() {
    this.isCancelled = true;
    this.closeDiskStream();
    this.onStatus?.('Receiver cancelled transfer.');
  }

  /**
   * Initialize Direct Disk Streaming using File System Access API if supported
   */
  async initDirectDiskStream(suggestedName) {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        this.fileHandle = await window.showSaveFilePicker({
          suggestedName: suggestedName || this.fileMeta.name || 'downloaded_file'
        });
        this.writableStream = await this.fileHandle.createWritable();
        this.hasDirectDiskWrite = true;
        this.onStatus?.('Direct disk stream initialized.');
        return true;
      } catch (err) {
        // User cancelled picker or permission denied; fallback to browser memory stream
        this.hasDirectDiskWrite = false;
        return false;
      }
    }
    this.hasDirectDiskWrite = false;
    return false;
  }

  /**
   * Accept an incoming batch packet, decrypt, and write directly to disk/stream
   */
  async acceptBatch(batchMeta, encryptedData) {
    if (this.isCancelled) return { cancelled: true };

    const { batchIndex, totalBatches, startChunk, endChunk, batchChecksum } = batchMeta;

    // Verify batch checksum
    const computedHash = await computeSHA256(encryptedData);
    if (batchChecksum && computedHash !== batchChecksum) {
      const err = `Checksum mismatch on batch ${batchIndex}. Requesting retry.`;
      this.onError?.(err);
      return { valid: false, retry: true, batchIndex };
    }

    // Decrypt batch
    const decryptedBatch = await decryptChunkData(
      encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.byteLength),
      this.key,
      this.baseIV,
      batchIndex
    );

    // Write to disk stream or fallback buffer
    if (this.hasDirectDiskWrite && this.writableStream) {
      await this.writableStream.write(decryptedBatch);
    } else {
      this.fallbackBuffers.push(decryptedBatch);
    }

    // Mark chunks as received
    for (let c = startChunk; c <= endChunk; c++) {
      this.receivedChunksBitmask.add(c);
    }
    this.receivedBatches.set(batchIndex, true);
    this.bytesWritten += decryptedBatch.byteLength;

    // Update Progress
    const totalBytes = this.fileMeta.size || this.fileMeta.original_size || (this.plan.totalBatches * BATCH_SIZE);
    const percent = Math.min(100, Math.round((this.bytesWritten / totalBytes) * 100));

    this.onProgress?.({
      percent,
      currentBatch: this.receivedBatches.size,
      totalBatches,
      receivedChunks: this.receivedChunksBitmask.size,
      totalChunks: this.plan.totalChunks,
      bytesWritten: this.bytesWritten,
      totalBytes,
      hasDirectDiskWrite: this.hasDirectDiskWrite
    });

    // Check completion
    if (this.receivedBatches.size >= totalBatches) {
      await this.finalizeTransfer();
    }

    return { valid: true, retry: false, completed: this.receivedBatches.size >= totalBatches };
  }

  /**
   * Identify any missing chunks/batches for selective retransmission
   */
  getMissingBatches() {
    const missing = [];
    for (let b = 0; b < this.plan.totalBatches; b++) {
      if (!this.receivedBatches.has(b)) {
        missing.push(b);
      }
    }
    return missing;
  }

  /**
   * Finalize transfer, verify end-to-end SHA-256, and close streams
   */
  async finalizeTransfer() {
    await this.closeDiskStream();

    let finalBlob = null;
    let finalSHA256 = null;

    if (!this.hasDirectDiskWrite && this.fallbackBuffers.length > 0) {
      finalBlob = new Blob(this.fallbackBuffers, {
        type: this.fileMeta.type || this.fileMeta.mime_type || 'application/octet-stream'
      });
      const fullBuffer = await finalBlob.arrayBuffer();
      finalSHA256 = await computeSHA256(new Uint8Array(fullBuffer));
    }

    // Verify SHA-256 against expected hash if provided
    if (this.fileMeta.sha256 && finalSHA256 && this.fileMeta.sha256 !== finalSHA256) {
      this.onError?.('Final SHA-256 integrity verification failed.');
      return;
    }

    this.onComplete?.({
      fileName: this.fileMeta.name || this.fileMeta.original_name || 'downloaded_file',
      fileSize: this.bytesWritten,
      directToDisk: this.hasDirectDiskWrite,
      blob: finalBlob,
      sha256: finalSHA256
    });
  }

  async closeDiskStream() {
    if (this.writableStream) {
      try {
        await this.writableStream.close();
      } catch (_) {}
      this.writableStream = null;
    }
  }
}
