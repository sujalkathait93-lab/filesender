/**
 * SecureShare Preview Manager Module
 * Manages decrypted file preview lifecycles, media Object URL allocations,
 * and automatic memory cleanup/revocation without artificial countdown timers.
 */

import { detectFileType } from './fileManager.js';

export class PreviewManager {
  constructor({ onClose } = {}) {
    this.onClose = onClose || (() => {});
    this.activeObjectUrls = new Set();
    this.currentPreview = null;
  }

  /**
   * Prepare a decrypted file for browser preview.
   * Allocates Object URLs for media or decodes text.
   */
  preparePreview(fileItem) {
    // Clean up any existing active URLs
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
        // Decode full text (safely up to 10 MB for browser DOM rendering performance)
        const textBytes = data ? (data.byteLength > 10 * 1024 * 1024 ? data.slice(0, 10 * 1024 * 1024) : data) : new Uint8Array();
        previewData = new TextDecoder('utf-8', { fatal: false }).decode(textBytes);
      } catch (_) {
        previewData = '(Unable to decode text content)';
        isDirect = false;
      }
    } else if (data && data.byteLength > 0 && data.byteLength <= 10 * 1024 * 1024) {
      // Automatic text fallback for any unlisted code or readable text file
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(data);
        // Ensure it contains printable text (no large runs of null bytes)
        const sample = decoded.slice(0, 1000);
        const nonPrintableCount = (sample.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
        if (nonPrintableCount / (sample.length || 1) < 0.05) {
          previewData = decoded;
          isDirect = true;
          detection.category = 'text';
        } else {
          isDirect = false;
          previewData = null;
        }
      } catch (_) {
        isDirect = false;
        previewData = null;
      }
    } else {
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

    return this.currentPreview;
  }

  /**
   * Close preview explicitly and revoke resources.
   */
  close() {
    this.cleanup();
    this.onClose();
  }

  /**
   * Revoke all active Object URLs and clear temporary buffers from memory.
   */
  cleanup() {
    for (const url of this.activeObjectUrls) {
      try {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
      } catch (_) {}
    }
    this.activeObjectUrls.clear();
    this.currentPreview = null;
  }
}
