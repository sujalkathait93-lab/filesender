/**
 * SecureShare WebRTC Sender Channel
 * Handles streaming binary file chunk transmission with flow control.
 */

import { encryptChunkData } from '../crypto.js';

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
const BUFFERED_AMOUNT_LOW = 256 * 1024; // 256 KB flow control threshold

export class SenderChannel {
  constructor({ dataChannel, rawCompressedData, encryptionKey, keyMeta, totalChunks, onProgress, onStatus, onComplete }) {
    this.dataChannel = dataChannel;
    this.rawCompressedData = rawCompressedData;
    this.encryptionKey = encryptionKey;
    this.keyMeta = keyMeta;
    this.totalChunks = totalChunks;
    this.onProgress = onProgress;
    this.onStatus = onStatus;
    this.onComplete = onComplete;

    this.sentChunkIndex = 0;
    this.isPaused = false;
    this.isCancelled = false;
    this.startTime = 0;
    this.lastSpeedCheckTime = 0;
    this.lastSpeedCheckBytes = 0;
    this.currentSpeed = 0;
  }

  async startSending() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
    if (this.isPaused || this.isCancelled) return;

    if (!this.startTime) {
      this.startTime = Date.now();
      this.lastSpeedCheckTime = Date.now();
      this.lastSpeedCheckBytes = 0;
    }

    this.dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW;

    const onLowBuffer = () => {
      this.dataChannel.onbufferedamountlow = null;
      this.startSending();
    };

    while (this.sentChunkIndex < this.totalChunks && !this.isPaused && !this.isCancelled) {
      if (this.dataChannel.bufferedAmount > BUFFERED_AMOUNT_LOW) {
        this.dataChannel.onbufferedamountlow = onLowBuffer;
        return;
      }

      const start = this.sentChunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, this.rawCompressedData.length);
      const chunkSlice = this.rawCompressedData.subarray(start, end);

      const encryptedChunk = await encryptChunkData(
        chunkSlice.buffer.slice(chunkSlice.byteOffset, chunkSlice.byteOffset + chunkSlice.byteLength),
        this.encryptionKey,
        this.keyMeta.iv,
        this.sentChunkIndex
      );

      const packet = new Uint8Array(8 + encryptedChunk.length);
      const view = new DataView(packet.buffer);
      view.setUint32(0, this.sentChunkIndex, false);
      view.setUint32(4, this.totalChunks, false);
      packet.set(encryptedChunk, 8);

      this.dataChannel.send(packet.buffer);

      this.sentChunkIndex++;
      this.updateProgress(this.sentChunkIndex * CHUNK_SIZE);
    }

    if (this.sentChunkIndex >= this.totalChunks) {
      this.onStatus?.('All WebRTC DataChannel chunks transmitted successfully!');
      this.onComplete?.();
    }
  }

  updateProgress(transferredBytes) {
    const totalBytes = this.rawCompressedData.length;
    const currentBytes = Math.min(transferredBytes, totalBytes);
    const percent = Math.min(100, Math.round((currentBytes / totalBytes) * 100));

    const now = Date.now();
    const timeDelta = (now - this.lastSpeedCheckTime) / 1000;

    if (timeDelta >= 0.5) {
      const bytesDelta = currentBytes - this.lastSpeedCheckBytes;
      this.currentSpeed = Math.round(bytesDelta / timeDelta);
      this.lastSpeedCheckTime = now;
      this.lastSpeedCheckBytes = currentBytes;
    }

    const remainingBytes = Math.max(0, totalBytes - currentBytes);
    const etaSeconds = this.currentSpeed > 0 ? Math.ceil(remainingBytes / this.currentSpeed) : 0;

    this.onProgress?.({
      percent,
      transferredBytes: currentBytes,
      totalBytes,
      currentChunk: this.sentChunkIndex,
      totalChunks: this.totalChunks,
      speedBytesPerSec: this.currentSpeed,
      etaSeconds,
      isPaused: this.isPaused
    });
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    this.startSending();
  }

  cancel() {
    this.isCancelled = true;
  }
}
