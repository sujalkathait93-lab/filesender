/**
 * SecureShare WebRTC Receiver Channel
 * Handles incoming binary chunks, chunk collection, decryption, and decompression.
 */

import { deriveKey, decryptChunkData } from '../crypto';
import { decompressData } from '../compression';
import { hexToBytes } from '../hexUtils';

const CHUNK_SIZE = 64 * 1024;

export class ReceiverChannel {
  constructor({ fileMeta, onProgress, onStatus, onComplete, onError }) {
    this.fileMeta = fileMeta;
    this.onProgress = onProgress;
    this.onStatus = onStatus;
    this.onComplete = onComplete;
    this.onError = onError;

    this.receivedChunks = new Map();
    this.totalChunks = fileMeta?.totalChunks || 0;
    this.startTime = 0;
    this.lastSpeedCheckTime = 0;
    this.lastSpeedCheckBytes = 0;
    this.currentSpeed = 0;
  }

  async handleIncomingChunk(packet) {
    if (packet.length < 8) return;

    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    const chunkIndex = view.getUint32(0, false);
    const totalChunks = view.getUint32(4, false);
    const encryptedChunkBytes = packet.subarray(8);

    if (!this.startTime) {
      this.startTime = Date.now();
      this.lastSpeedCheckTime = Date.now();
      this.lastSpeedCheckBytes = 0;
    }

    this.totalChunks = totalChunks;
    this.receivedChunks.set(chunkIndex, encryptedChunkBytes);

    this.updateProgress(this.receivedChunks.size * CHUNK_SIZE);

    if (this.receivedChunks.size === totalChunks) {
      this.onStatus?.('All WebRTC DataChannel chunks received! Assembling & decrypting file...');
      await this.assembleAndDecryptFile();
    }
  }

  async assembleAndDecryptFile(passwordOverride) {
    try {
      const password = passwordOverride || this.fileMeta?.password;
      const ivHex = this.fileMeta?.iv;
      const saltHex = this.fileMeta?.salt;

      if (!password || !ivHex || !saltHex) {
        throw new Error('Missing decryption key or metadata parameters');
      }

      const iv = hexToBytes(ivHex);
      const salt = hexToBytes(saltHex);

      if (!iv || !salt) {
        throw new Error('Invalid IV or Salt format');
      }

      const key = await deriveKey(password, salt);

      const decryptedChunkBuffers = [];
      let totalDecryptedSize = 0;

      for (let i = 0; i < this.totalChunks; i++) {
        const encChunk = this.receivedChunks.get(i);
        if (!encChunk) throw new Error(`Missing chunk index ${i}`);

        const decChunk = await decryptChunkData(
          encChunk.buffer.slice(encChunk.byteOffset, encChunk.byteOffset + encChunk.byteLength),
          key,
          iv,
          i
        );

        decryptedChunkBuffers.push(decChunk);
        totalDecryptedSize += decChunk.length;
      }

      const combinedCompressed = new Uint8Array(totalDecryptedSize);
      let offset = 0;
      for (const buf of decryptedChunkBuffers) {
        combinedCompressed.set(buf, offset);
        offset += buf.length;
      }

      const decompressedData = await decompressData(combinedCompressed);

      this.onComplete?.({
        fileData: decompressedData,
        originalName: this.fileMeta?.originalName || 'decrypted_file'
      });
    } catch (err) {
      this.onError?.(`Assembly & Decryption error: ${err.message}`);
    }
  }

  updateProgress(transferredBytes) {
    const totalBytes = (this.fileMeta?.compressedSize || (this.totalChunks * CHUNK_SIZE)) || 1;
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
      currentChunk: this.receivedChunks.size,
      totalChunks: this.totalChunks,
      speedBytesPerSec: this.currentSpeed,
      etaSeconds
    });
  }
}
