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
        const textSlice = data ? data.slice(0, 100000) : new Uint8Array();
        previewData = new TextDecoder('utf-8', { fatal: false }).decode(textSlice);
      } catch (_) {
        previewData = '(Unable to decode text content)';
        isDirect = false;
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
