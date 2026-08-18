/**
 * FileShare WebRTC Sender Channel with Smart Optimization & Dynamic Backpressure
 *
 * Handles streaming binary transmission over WebRTC DataChannel with:
 * - Dynamic backpressure flow control via bufferedAmountLowThreshold
 * - Configurable Chunk Parallelism (up to 3 in-flight chunks)
 * - Single-chunk recovery without full file retransmission
 * - Transfer state preservation and resume support
 * - Dynamic congestion avoidance
 */

import { StreamBatchSender, CHUNK_SIZE } from '../chunkManager.js';
import { SmartTransferOptimizer } from '../services/smartTransferOptimizer.js';

export class SenderChannel {
  constructor({
    dataChannel,
    file,
    encryptionKey,
    keyMeta,
    fileId,
    transferId,
    chunkSize = null,
    maxParallelism = null,
    onProgress,
    onStatus,
    onComplete,
    onError
  }) {
    this.dataChannel = dataChannel;
    this.file = file;
    this.encryptionKey = encryptionKey;
    this.keyMeta = keyMeta;
    this.fileId = fileId;
    this.transferId = transferId;
    this.onProgress = onProgress;
    this.onStatus = onStatus;
    this.onComplete = onComplete;
    this.onError = onError;

    this.streamSender = new StreamBatchSender({
      file,
      key: encryptionKey,
      baseIV: keyMeta.iv,
      fileId,
      transferId,
      chunkSize,
      maxParallelism,
      onProgress: (p) => this.handleSenderProgress(p),
      onStatus
    });

    this.plan = this.streamSender.plan;
    this.bufferThreshold = this.plan.bufferThreshold || (512 * 1024);
    this.activeParallelism = this.plan.maxParallelism || 1;
    this.consecutiveRetries = 0;

    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = 0;
    this.lastSpeedCheckTime = 0;
    this.lastSpeedCheckBytes = 0;
    this.currentSpeed = 0;

    this.setupDataChannelListeners();
  }

  setupDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.type === 'RETRY_CHUNK' && typeof msg.chunkIndex === 'number') {
            this.handleChunkRetryRequest(msg.chunkIndex);
          } else if (msg.type === 'RETRY_BATCH' && typeof msg.batchIndex === 'number') {
            await this.retransmitBatch(msg.batchIndex);
          } else if (msg.type === 'REQUEST_RESUME') {
            await this.handleResumeRequest(msg.missingChunks || msg.missingBatches);
          } else if (msg.type === 'CANCEL') {
            this.cancel();
          }
        }
      } catch (_) {}
    };
  }

  /**
   * Wait for DataChannel buffer to drain below threshold (Backpressure Flow Control)
   */
  async waitForBufferDrain() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    if (this.dataChannel.bufferedAmount > this.bufferThreshold) {
      // Temporarily throttle parallelism if buffer is severely saturated
      if (this.activeParallelism > 1 && this.dataChannel.bufferedAmount > this.bufferThreshold * 2) {
        this.activeParallelism = Math.max(1, this.activeParallelism - 1);
      }

      await new Promise((resolve) => {
        const handler = () => {
          this.dataChannel.removeEventListener('bufferedamountlow', handler);
          resolve();
        };
        this.dataChannel.addEventListener('bufferedamountlow', handler);
      });
    }
  }

  async startSending() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    if (this.isPaused || this.isCancelled) return;

    this.startTime = Date.now();
    this.lastSpeedCheckTime = Date.now();
    this.lastSpeedCheckBytes = 0;

    this.dataChannel.bufferedAmountLowThreshold = this.bufferThreshold;

    try {
      for await (const batch of this.streamSender.streamBatches()) {
        if (this.isCancelled) break;

        // Flow control check
        await this.waitForBufferDrain();

        // Send Batch Header with rich metadata
        const header = JSON.stringify({
          type: 'BATCH_DATA',
          transferId: batch.transferId,
          fileId: batch.fileId,
          fileName: batch.fileName,
          fileSize: batch.fileSize,
          batchIndex: batch.batchIndex,
          totalBatches: batch.totalBatches,
          startChunk: batch.startChunk,
          endChunk: batch.endChunk,
          totalChunks: batch.totalChunks,
          chunkSize: batch.chunkSize,
          chunkChecksums: batch.chunkChecksums,
          batchChecksum: batch.batchChecksum,
          mode: this.plan.mode,
          bufferLevel: this.plan.bufferLevel,
          maxParallelism: this.plan.maxParallelism,
          isSmartOptimized: this.plan.isSmartOptimized
        });

        // Prefix header length (4 bytes) + UTF-8 header + Encrypted Batch Payload
        const headerBytes = new TextEncoder().encode(header);
        const packet = new Uint8Array(4 + headerBytes.length + batch.data.byteLength);
        const view = new DataView(packet.buffer);
        view.setUint32(0, headerBytes.length, false);
        packet.set(headerBytes, 4);
        packet.set(new Uint8Array(batch.data), 4 + headerBytes.length);

        this.dataChannel.send(packet.buffer);
      }

      if (!this.isCancelled) {
        // Send Completion EOF Message
        this.dataChannel.send(JSON.stringify({
          type: 'TRANSFER_COMPLETE',
          fileId: this.fileId,
          fileName: this.file.name,
          totalBatches: this.plan.totalBatches,
          totalChunks: this.plan.totalChunks
        }));
        this.onStatus?.('All chunks streamed and sent successfully!');
        this.onComplete?.();
      }
    } catch (err) {
      this.onError?.(`Transmission failed: ${err.message}`);
    }
  }

  /**
   * Handle single chunk retry request from receiver
   */
  async handleChunkRetryRequest(chunkIndex) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    this.consecutiveRetries++;
    if (this.consecutiveRetries > 2 && this.activeParallelism > 1) {
      this.activeParallelism = 1; // Demote concurrency on instability
    }

    try {
      const chunk = await this.streamSender.retransmitChunk(chunkIndex);
      await this.waitForBufferDrain();

      const header = JSON.stringify({
        type: 'CHUNK_RETRY',
        transferId: chunk.transferId,
        fileId: chunk.fileId,
        fileName: chunk.fileName,
        fileSize: chunk.fileSize,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        chunkSize: chunk.chunkSize,
        mimeType: chunk.mimeType,
        checksum: chunk.checksum,
        encryptedChecksum: chunk.encryptedChecksum
      });

      const headerBytes = new TextEncoder().encode(header);
      const packet = new Uint8Array(4 + headerBytes.length + chunk.data.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, headerBytes.length, false);
      packet.set(headerBytes, 4);
      packet.set(new Uint8Array(chunk.data), 4 + headerBytes.length);

      this.dataChannel.send(packet.buffer);
    } catch (err) {
      this.onError?.(`Failed to retransmit chunk ${chunkIndex}: ${err.message}`);
    }
  }

  /**
   * Retransmit batch without restarting file
   */
  async retransmitBatch(batchIndex) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.onStatus?.(`Retransmitting batch ${batchIndex + 1}/${this.plan.totalBatches}...`);

    this.consecutiveRetries++;
    if (this.consecutiveRetries > 2 && this.activeParallelism > 1) {
      this.activeParallelism = 1;
    }

    try {
      const batch = await this.streamSender.processBatch(batchIndex);
      await this.waitForBufferDrain();

      const header = JSON.stringify({
        type: 'BATCH_RETRY',
        batchIndex: batch.batchIndex,
        totalBatches: batch.totalBatches,
        startChunk: batch.startChunk,
        endChunk: batch.endChunk,
        chunkSize: batch.chunkSize,
        batchChecksum: batch.batchChecksum
      });

      const headerBytes = new TextEncoder().encode(header);
      const packet = new Uint8Array(4 + headerBytes.length + batch.data.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, headerBytes.length, false);
      packet.set(headerBytes, 4);
      packet.set(new Uint8Array(batch.data), 4 + headerBytes.length);

      this.dataChannel.send(packet.buffer);
    } catch (err) {
      this.onError?.(`Failed to retransmit batch ${batchIndex}: ${err.message}`);
    }
  }

  /**
   * Handle resume request: retransmits only specified missing chunks
   */
  async handleResumeRequest(missingItems) {
    if (!Array.isArray(missingItems) || missingItems.length === 0) return;
    this.onStatus?.(`Resuming transfer: sending ${missingItems.length} missing items...`);

    for (const itemIndex of missingItems) {
      if (this.isCancelled) break;
      await this.retransmitBatch(itemIndex);
    }
  }

  handleSenderProgress({ percent, currentBatch, totalBatches, currentChunk, totalChunks, bytesProcessed, totalBytes, chunkSize, mode, isSmartOptimized }) {
    const now = Date.now();
    const timeDelta = (now - this.lastSpeedCheckTime) / 1000;

    if (timeDelta >= 0.5) {
      const bytesDelta = bytesProcessed - this.lastSpeedCheckBytes;
      this.currentSpeed = Math.round(bytesDelta / timeDelta);
      this.lastSpeedCheckTime = now;
      this.lastSpeedCheckBytes = bytesProcessed;
    }

    const remainingBytes = Math.max(0, totalBytes - bytesProcessed);
    const etaSeconds = this.currentSpeed > 0 ? Math.ceil(remainingBytes / this.currentSpeed) : 0;

    this.onProgress?.({
      percent,
      transferredBytes: bytesProcessed,
      totalBytes,
      currentBatch,
      totalBatches,
      currentChunk,
      totalChunks,
      chunkSize,
      mode,
      isSmartOptimized: isSmartOptimized !== undefined ? isSmartOptimized : true,
      speedBytesPerSec: this.currentSpeed,
      etaSeconds,
      isPaused: this.isPaused
    });
  }

  pause() {
    this.isPaused = true;
    this.streamSender.pause();
  }

  resume() {
    this.isPaused = false;
    this.streamSender.resume();
  }

  cancel() {
    this.isCancelled = true;
    this.streamSender.cancel();
    try {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'CANCEL' }));
      }
    } catch (_) {}
  }
}
