/**
 * FileShare WebRTC Receiver Channel
 * Handles incoming binary batches, verifies checksums, requests retries for dropped batches,
 * and streams decrypted data directly to disk via File System Access API.
 */

import { StreamBatchReceiver } from '../chunkManager.js';
import { deriveKey } from '../crypto.js';
import { hexToBytes } from '../hexUtils.js';

export class ReceiverChannel {
  constructor({ dataChannel, fileMeta, onProgress, onStatus, onComplete, onError }) {
    this.dataChannel = dataChannel;
    this.fileMeta = fileMeta;
    this.onProgress = onProgress;
    this.onStatus = onStatus;
    this.onComplete = onComplete;
    this.onError = onError;

    this.streamReceiver = null;
    this.key = null;
    this.baseIV = null;
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
          if (msg.type === 'TRANSFER_COMPLETE') {
            this.onStatus?.('Transfer complete notification received.');
          } else if (msg.type === 'CANCEL') {
            this.onStatus?.('Sender cancelled transfer.');
            this.streamReceiver?.cancel();
          }
        } else if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
          const buffer = event.data instanceof Uint8Array ? event.data : new Uint8Array(event.data);
          await this.handleIncomingPacket(buffer);
        }
      } catch (err) {
        this.onError?.(`Receiver error: ${err.message}`);
      }
    };
  }

  /**
   * Initialize decryption keys and receiver stream
   */
  async initializeReceiver(passwordOverride) {
    const password = passwordOverride || this.fileMeta?.password;
    const ivHex = this.fileMeta?.iv;
    const saltHex = this.fileMeta?.salt;

    if (!password || !ivHex || !saltHex) {
      throw new Error('Missing decryption parameters (password, IV, or Salt)');
    }

    this.baseIV = hexToBytes(ivHex);
    const salt = hexToBytes(saltHex);
    if (!this.baseIV || !salt) {
      throw new Error('Invalid IV or Salt format');
    }

    this.key = await deriveKey(password, salt);

    this.streamReceiver = new StreamBatchReceiver({
      fileMeta: this.fileMeta,
      key: this.key,
      baseIV: this.baseIV,
      onProgress: (p) => this.handleReceiverProgress(p),
      onStatus: this.onStatus,
      onComplete: this.onComplete,
      onError: this.onError
    });

    // Attempt direct disk stream initialization
    await this.streamReceiver.initDirectDiskStream(this.fileMeta.name || this.fileMeta.original_name);
  }

  async handleIncomingPacket(packet) {
    if (packet.length < 4) return;
    if (!this.streamReceiver) {
      await this.initializeReceiver();
    }

    if (!this.startTime) {
      this.startTime = Date.now();
      this.lastSpeedCheckTime = Date.now();
      this.lastSpeedCheckBytes = 0;
    }

    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    const headerLength = view.getUint32(0, false);
    const headerBytes = packet.subarray(4, 4 + headerLength);
    const headerJson = new TextDecoder().decode(headerBytes);
    const batchMeta = JSON.parse(headerJson);

    const encryptedData = packet.subarray(4 + headerLength);

    const result = await this.streamReceiver.acceptBatch(batchMeta, encryptedData);

    if (result.retry) {
      // Send NACK to sender requesting batch retransmission
      this.requestBatchRetry(result.batchIndex);
    }
  }

  requestBatchRetry(batchIndex) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.onStatus?.(`Requesting retransmission for batch ${batchIndex}...`);
      this.dataChannel.send(JSON.stringify({
        type: 'RETRY_BATCH',
        batchIndex
      }));
    }
  }

  handleReceiverProgress({ percent, currentBatch, totalBatches, receivedChunks, totalChunks, bytesWritten, totalBytes, hasDirectDiskWrite }) {
    const now = Date.now();
    const timeDelta = (now - this.lastSpeedCheckTime) / 1000;

    if (timeDelta >= 0.5) {
      const bytesDelta = bytesWritten - this.lastSpeedCheckBytes;
      this.currentSpeed = Math.round(bytesDelta / timeDelta);
      this.lastSpeedCheckTime = now;
      this.lastSpeedCheckBytes = bytesWritten;
    }

    const remainingBytes = Math.max(0, totalBytes - bytesWritten);
    const etaSeconds = this.currentSpeed > 0 ? Math.ceil(remainingBytes / this.currentSpeed) : 0;

    this.onProgress?.({
      percent,
      transferredBytes: bytesWritten,
      totalBytes,
      currentBatch,
      totalBatches,
      currentChunk: receivedChunks,
      totalChunks,
      speedBytesPerSec: this.currentSpeed,
      etaSeconds,
      hasDirectDiskWrite
    });
  }

  cancel() {
    this.isCancelled = true;
    this.streamReceiver?.cancel();
    try {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'CANCEL' }));
      }
    } catch (_) {}
  }
}
