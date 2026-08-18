/**
 * FileShare WebRTC Sender Channel
 * Handles streaming binary batch transmission over WebRTC DataChannel
 * with backpressure flow control, retry handlers, and cancellation.
 */

import { StreamBatchSender, CHUNK_SIZE, BATCH_SIZE } from '../chunkManager.js';

const BUFFERED_AMOUNT_LOW = 512 * 1024; // 512 KB backpressure threshold

export class SenderChannel {
  constructor({ dataChannel, file, encryptionKey, keyMeta, fileId, transferId, onProgress, onStatus, onComplete, onError }) {
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
      onProgress: (p) => this.handleSenderProgress(p),
      onStatus
    });

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

    // Handle messages from receiver (e.g. NACK / retry requests)
    this.dataChannel.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.type === 'RETRY_BATCH' && typeof msg.batchIndex === 'number') {
            await this.retransmitBatch(msg.batchIndex);
          } else if (msg.type === 'CANCEL') {
            this.cancel();
          }
        }
      } catch (_) {}
    };
  }

  async startSending() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    if (this.isPaused || this.isCancelled) return;

    this.startTime = Date.now();
    this.lastSpeedCheckTime = Date.now();
    this.lastSpeedCheckBytes = 0;

    this.dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW;

    try {
      for await (const batch of this.streamSender.streamBatches()) {
        if (this.isCancelled) break;

        // Flow control: wait if buffer exceeds threshold
        if (this.dataChannel.bufferedAmount > BUFFERED_AMOUNT_LOW) {
          await new Promise((resolve) => {
            this.dataChannel.onbufferedamountlow = () => {
              this.dataChannel.onbufferedamountlow = null;
              resolve();
            };
          });
        }

        // Send Batch Header
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
          chunkChecksums: batch.chunkChecksums,
          batchChecksum: batch.batchChecksum
        });

        // Prefix header length (4 bytes) + JSON header + Encrypted Batch Payload
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
        this.dataChannel.send(JSON.stringify({ type: 'TRANSFER_COMPLETE', fileId: this.fileId }));
        this.onStatus?.('All batches streamed and sent successfully!');
        this.onComplete?.();
      }
    } catch (err) {
      this.onError?.(`Transmission failed: ${err.message}`);
    }
  }

  async retransmitBatch(batchIndex) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.onStatus?.(`Retransmitting batch ${batchIndex}...`);
    const batch = await this.streamSender.processBatch(batchIndex);

    const header = JSON.stringify({
      type: 'BATCH_RETRY',
      batchIndex: batch.batchIndex,
      totalBatches: batch.totalBatches,
      startChunk: batch.startChunk,
      endChunk: batch.endChunk,
      batchChecksum: batch.batchChecksum
    });

    const headerBytes = new TextEncoder().encode(header);
    const packet = new Uint8Array(4 + headerBytes.length + batch.data.byteLength);
    const view = new DataView(packet.buffer);
    view.setUint32(0, headerBytes.length, false);
    packet.set(headerBytes, 4);
    packet.set(new Uint8Array(batch.data), 4 + headerBytes.length);

    this.dataChannel.send(packet.buffer);
  }

  handleSenderProgress({ percent, currentBatch, totalBatches, currentChunk, totalChunks, bytesProcessed, totalBytes }) {
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
