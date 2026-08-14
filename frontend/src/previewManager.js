/**
 * SecureShare Preview Manager Module (LLD: Preview Manager)
 * Manages the 30-second temporary file preview lifecycle, countdown timers,
 * media Object URL allocations, and automatic memory cleanup/revocation.
 */

import { detectFileType } from './fileManager.js';

export const PREVIEW_DURATION_SECONDS = 30;

export class PreviewManager {
  constructor({ onTick, onExpire, onClose } = {}) {
    this.onTick = onTick || (() => {});
    this.onExpire = onExpire || (() => {});
    this.onClose = onClose || (() => {});

    this.timerId = null;
    this.secondsLeft = PREVIEW_DURATION_SECONDS;
    this.activeObjectUrls = new Set();
    this.currentPreview = null;
  }

  /**
   * Prepare a decrypted file or file list for temporary 30-second preview.
   * Creates appropriate Object URLs or text decodings and starts the 30s countdown.
   */
  preparePreview(fileItem) {
    // Clean up any previous preview first
    this.cleanup();

    const { name, size, type, data, blob } = fileItem;
    const detection = detectFileType(name, type);
    let previewData = null;
    let previewUrl = null;
    let isDirect = detection.canPreviewDirectly;

    if (detection.category === 'image' || detection.category === 'video' || detection.category === 'audio' || detection.category === 'pdf') {
      const mediaBlob = blob || new Blob([data], { type: detection.mime });
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        previewUrl = URL.createObjectURL(mediaBlob);
        this.activeObjectUrls.add(previewUrl);
      } else {
        previewUrl = `blob:${name}`;
      }
      previewData = previewUrl;
    } else if (detection.category === 'text') {
      try {
        const textSlice = data ? data.slice(0, 50000) : new Uint8Array();
        previewData = new TextDecoder('utf-8', { fatal: false }).decode(textSlice);
      } catch (_) {
        previewData = '(Unable to decode text content)';
        isDirect = false;
      }
    } else {
      // Document or unsupported binary -> show clean file info screen
      isDirect = false;
      previewData = null;
    }

    this.currentPreview = {
      fileName: name,
      fileSize: size,
      mimeType: type || detection.mime,
      category: detection.category,
      canPreviewDirectly: isDirect,
      content: previewData,
      url: previewUrl,
      startedAt: Date.now()
    };

    this.startCountdown();
    return this.currentPreview;
  }

  /**
   * Start 30-second countdown timer.
   */
  startCountdown() {
    this.stopCountdown();
    this.secondsLeft = PREVIEW_DURATION_SECONDS;
    this.onTick(this.secondsLeft);

    this.timerId = setInterval(() => {
      this.secondsLeft -= 1;
      this.onTick(this.secondsLeft);

      if (this.secondsLeft <= 0) {
        this.stopCountdown();
        this.onExpire();
        this.cleanup();
      }
    }, 1000);
  }

  /**
   * Stop timer without revoking immediately.
   */
  stopCountdown() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Close preview explicitly and revoke all resources.
   */
  close() {
    this.stopCountdown();
    this.cleanup();
    this.onClose();
  }

  /**
   * Revoke all active Object URLs and clear temporary buffers from memory.
   */
  cleanup() {
    this.stopCountdown();
    for (const url of this.activeObjectUrls) {
      try {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
      } catch (_) {}
    }
    this.activeObjectUrls.clear();
    this.currentPreview = null;
    this.secondsLeft = PREVIEW_DURATION_SECONDS;
  }

  /**
   * Get current seconds left.
   */
  getSecondsLeft() {
    return this.secondsLeft;
  }
}
