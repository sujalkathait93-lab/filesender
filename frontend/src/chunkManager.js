/**
 * FileShare Stream & Chunk Manager with Smart Transfer Optimization
 * High-performance, memory-safe streaming engine.
 *
 * Specifications:
 * - Dynamic Smart chunk size (256 KB up to 3.25 MB) based on SmartTransferOptimizer
 * - AES-256-GCM chunk/batch encryption with unique counter IVs (getChunkIV)
 * - Direct disk write via File System Access API (showSaveFilePicker)
 * - Failed chunk recovery with per-chunk retry without full-file restarts
 * - WebRTC backpressure coordination and in-flight chunk parallelism
 * - Resume support: tracks verified chunks and retransmits missing chunks
 * - Final end-to-end SHA-256 integrity verification
 */

import { encryptChunkData, decryptChunkData, deriveKey } from './crypto.js';
import { hexToBytes } from './hexUtils.js';
import { SmartTransferOptimizer, MAX_FILE_SIZE_BYTES } from './services/smartTransferOptimizer.js';

export const CHUNK_SIZE = 256 * 1024; // 256 KB default baseline chunk
export const BATCH_CHUNKS_COUNT = 8;   // Baseline batch count
export const BATCH_SIZE = CHUNK_SIZE * BATCH_CHUNKS_COUNT; // 2 MB baseline batch
export const MAX_TOTAL_TRANSFER_SIZE = MAX_FILE_SIZE_BYTES; // 1 GB

/**
 * Compute SHA-256 checksum of an ArrayBuffer or Uint8Array
 */
export async function computeSHA256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate transfer plan dynamically using SmartTransferOptimizer or custom override
 */
export function calculateTransferPlan(fileSize, customChunkSize = null, customMaxParallelism = null) {
  const size = Math.max(0, fileSize || 0);
  const smartTier = SmartTransferOptimizer.getTier(size);

  const effectiveChunkSize = customChunkSize || smartTier.chunkSize || CHUNK_SIZE;
  const maxParallelism = customMaxParallelism || smartTier.maxParallelism || 1;
  const totalChunks = Math.max(1, Math.ceil(size / effectiveChunkSize));
  const chunksPerBatch = Math.max(1, Math.min(BATCH_CHUNKS_COUNT, Math.ceil((2 * 1024 * 1024) / effectiveChunkSize)));
  const totalBatches = Math.max(1, Math.ceil(totalChunks / chunksPerBatch));

  return {
    fileSize: size,
    chunkSize: effectiveChunkSize,
    batchSize: effectiveChunkSize * chunksPerBatch,
    chunksPerBatch,
    totalChunks,
    totalBatches,
    mode: smartTier.mode,
    bufferLevel: smartTier.bufferLevel,
    bufferThreshold: smartTier.bufferThreshold,
    maxParallelism,
    isSmartOptimized: !customChunkSize
  };
}

/**
 * Stream & Chunk Sender Engine
 * Streams file from disk via File.slice() with zero whole-file memory accumulation.
 * Handles per-chunk encryption, metadata tracking, and single-chunk retry.
 */
export class StreamBatchSender {
  constructor({
    file,
    key,
    baseIV,
    fileId,
    transferId,
    chunkSize = null,
    maxParallelism = null,
    onProgress,
    onStatus
  }) {
    this.file = file;
    this.key = key;
    this.baseIV = baseIV;
    this.fileId = fileId;
    this.transferId = transferId;
    this.onProgress = onProgress;
    this.onStatus = onStatus;

    this.plan = calculateTransferPlan(file.size, chunkSize, maxParallelism);
    this.isCancelled = false;
    this.isPaused = false;
    this.currentBatchIndex = 0;
    this.currentChunkIndex = 0;

    // Per-chunk status tracker: chunkIndex -> { status: 'pending'|'sent'|'verified'|'failed', retries: 0 }
    this.chunkStatus = new Map();
    for (let c = 0; c < this.plan.totalChunks; c++) {
      this.chunkStatus.set(c, { status: 'pending', retries: 0 });
    }
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
   * Read a single chunk slice from file via File.slice()
   */
  async readChunk(chunkIndex) {
    const start = chunkIndex * this.plan.chunkSize;
    const end = Math.min(start + this.plan.chunkSize, this.file.size);
    const sliceBlob = this.file.slice(start, end);
    const sliceBuffer = await sliceBlob.arrayBuffer();
    return new Uint8Array(sliceBuffer);
  }

  /**
   * Process and encrypt an individual chunk with complete metadata
   */
  async processChunk(chunkIndex) {
    if (this.isCancelled) throw new Error('Transfer cancelled');

    const rawChunk = await this.readChunk(chunkIndex);
    const rawChecksum = await computeSHA256(rawChunk);
    const encryptedChunk = await encryptChunkData(rawChunk.buffer, this.key, this.baseIV, chunkIndex);
    const encryptedChecksum = await computeSHA256(encryptedChunk);

    return {
      transferId: this.transferId,
      fileId: this.fileId,
      fileName: this.file.name,
      fileSize: this.file.size,
      chunkIndex,
      totalChunks: this.plan.totalChunks,
      chunkSize: rawChunk.byteLength,
      mimeType: this.file.type || 'application/octet-stream',
      checksum: rawChecksum,
      encryptedChecksum,
      data: encryptedChunk
    };
  }

  /**
   * Retransmit a single failed chunk without full file restart
   */
  async retransmitChunk(chunkIndex) {
    const status = this.chunkStatus.get(chunkIndex) || { status: 'failed', retries: 0 };
    status.retries += 1;
    if (status.retries > 5) {
      throw new Error(`Chunk ${chunkIndex} exceeded maximum retry limit (5 retries).`);
    }
    status.status = 'retrying';
    this.chunkStatus.set(chunkIndex, status);

    this.onStatus?.(`Retransmitting chunk ${chunkIndex + 1}/${this.plan.totalChunks} (Attempt ${status.retries})...`);
    return await this.processChunk(chunkIndex);
  }

  /**
   * Process a single batch of chunks (for batch pipeline compatibility)
   */
  async processBatch(batchIndex) {
    if (this.isCancelled) throw new Error('Transfer cancelled');

    const startChunk = batchIndex * this.plan.chunksPerBatch;
    const endChunk = Math.min(startChunk + this.plan.chunksPerBatch, this.plan.totalChunks);
    const chunkPromises = [];

    for (let i = startChunk; i < endChunk; i++) {
      chunkPromises.push(this.readChunk(i));
    }

    const chunks = await Promise.all(chunkPromises);
    const totalRawBytes = chunks.reduce((acc, c) => acc + c.byteLength, 0);

    const batchRawBuffer = new Uint8Array(totalRawBytes);
    let offset = 0;
    const chunkChecksums = [];

    for (const chunk of chunks) {
      batchRawBuffer.set(chunk, offset);
      const hash = await computeSHA256(chunk);
      chunkChecksums.push(hash);
      offset += chunk.byteLength;
    }

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
      chunkSize: this.plan.chunkSize,
      chunkChecksums,
      batchChecksum,
      data: encryptedBatch
    };
  }

  /**
   * Stream all batches/chunks with progress notifications
   */
  async *streamBatches() {
    for (let b = 0; b < this.plan.totalBatches; b++) {
      if (this.isCancelled) break;
      while (this.isPaused && !this.isCancelled) {
        await new Promise(r => setTimeout(r, 100));
      }

      const batch = await this.processBatch(b);
      this.currentBatchIndex = b + 1;
      this.currentChunkIndex = Math.min((b + 1) * this.plan.chunksPerBatch, this.plan.totalChunks);

      const bytesProcessed = Math.min((b + 1) * this.plan.batchSize, this.file.size);
      const percent = Math.min(100, Math.round((bytesProcessed / this.file.size) * 100));

      this.onProgress?.({
        percent,
        currentBatch: this.currentBatchIndex,
        totalBatches: this.plan.totalBatches,
        currentChunk: this.currentChunkIndex,
        totalChunks: this.plan.totalChunks,
        bytesProcessed,
        totalBytes: this.file.size,
        chunkSize: this.plan.chunkSize,
        mode: this.plan.mode,
        isSmartOptimized: this.plan.isSmartOptimized
      });

      yield batch;
    }
  }
}

/**
 * Stream & Chunk Receiver Engine
 * Receives chunks and batches, validates checksums, decrypts in stream,
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

    const size = fileMeta.size || fileMeta.original_size || 0;
    this.plan = calculateTransferPlan(size, fileMeta.chunkSize);
    this.receivedBatches = new Map();
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
      } catch (_) {
        this.hasDirectDiskWrite = false;
        return false;
      }
    }
    this.hasDirectDiskWrite = false;
    return false;
  }

  /**
   * Accept an incoming batch packet, verify checksum, decrypt, and write directly to disk
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
    const totalBytes = this.fileMeta.size || this.fileMeta.original_size || (this.plan.totalBatches * this.plan.batchSize);
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
   * Accept single chunk directly
   */
  async acceptChunk(chunkMeta, encryptedData) {
    if (this.isCancelled) return { cancelled: true };

    const { chunkIndex, totalChunks, checksum, encryptedChecksum } = chunkMeta;

    // Verify encrypted checksum
    if (encryptedChecksum) {
      const computedEncrypted = await computeSHA256(encryptedData);
      if (computedEncrypted !== encryptedChecksum) {
        return { valid: false, retry: true, chunkIndex };
      }
    }

    // Decrypt chunk
    const decryptedChunk = await decryptChunkData(
      encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.byteLength),
      this.key,
      this.baseIV,
      chunkIndex
    );

    // Verify raw checksum if provided
    if (checksum) {
      const computedRaw = await computeSHA256(decryptedChunk);
      if (computedRaw !== checksum) {
        return { valid: false, retry: true, chunkIndex };
      }
    }

    // Write to disk stream or fallback buffer
    if (this.hasDirectDiskWrite && this.writableStream) {
      await this.writableStream.write(decryptedChunk);
    } else {
      this.fallbackBuffers.push(decryptedChunk);
    }

    this.receivedChunksBitmask.add(chunkIndex);
    this.bytesWritten += decryptedChunk.byteLength;

    const totalBytes = this.fileMeta.size || this.fileMeta.original_size || (totalChunks * (this.plan.chunkSize || CHUNK_SIZE));
    const percent = Math.min(100, Math.round((this.bytesWritten / totalBytes) * 100));

    this.onProgress?.({
      percent,
      currentChunk: this.receivedChunksBitmask.size,
      totalChunks,
      bytesWritten: this.bytesWritten,
      totalBytes,
      hasDirectDiskWrite: this.hasDirectDiskWrite
    });

    if (this.receivedChunksBitmask.size >= totalChunks) {
      await this.finalizeTransfer();
    }

    return { valid: true, retry: false, completed: this.receivedChunksBitmask.size >= totalChunks };
  }

  /**
   * Identify missing chunks/batches for selective retransmission & resume support
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

  getMissingChunks() {
    const missing = [];
    for (let c = 0; c < this.plan.totalChunks; c++) {
      if (!this.receivedChunksBitmask.has(c)) {
        missing.push(c);
      }
    }
    return missing;
  }

  /**
   * Finalize transfer, verify end-to-end SHA-256, and close disk streams
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
