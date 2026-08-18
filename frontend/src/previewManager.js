/**
 * FileShare Preview Manager Module
 * Manages decrypted file preview lifecycles, media Object URL allocations,
 * and automatic memory cleanup/revocation according to SOLID principles.
 */

import { detectFileType } from './fileManager.js';

const MAX_DECODABLE_TEXT_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Preview Provider Strategies (Open/Closed Principle & Single Responsibility)
 */
const PREVIEW_STRATEGIES = [
  {
    canHandle: (detection) =>
      ['image', 'video', 'audio', 'pdf'].includes(detection.category),
    process: (fileItem, detection, registerUrl) => {
      const mediaBlob = fileItem.blob || new Blob([fileItem.data], { type: detection.mime });
      let previewUrl = null;
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        previewUrl = URL.createObjectURL(mediaBlob);
        registerUrl(previewUrl);
      } else {
        previewUrl = `blob:${fileItem.name}`;
      }
      return {
        previewData: previewUrl,
        previewUrl,
        isDirect: true,
        category: detection.category
      };
    }
  },
  {
    canHandle: (detection) => detection.category === 'text',
    process: (fileItem, detection) => {
      try {
        const textBytes = fileItem.data
          ? fileItem.data.byteLength > MAX_DECODABLE_TEXT_SIZE
            ? fileItem.data.slice(0, MAX_DECODABLE_TEXT_SIZE)
            : fileItem.data
          : new Uint8Array();
        const previewData = new TextDecoder('utf-8', { fatal: false }).decode(textBytes);
        return { previewData, previewUrl: null, isDirect: true, category: 'text' };
      } catch (_) {
        return { previewData: '(Unable to decode text content)', previewUrl: null, isDirect: false, category: 'text' };
      }
    }
  },
  {
    canHandle: (_, fileItem) =>
      Boolean(fileItem.data && fileItem.data.byteLength > 0 && fileItem.data.byteLength <= MAX_DECODABLE_TEXT_SIZE),
    process: (fileItem) => {
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(fileItem.data);
        const sample = decoded.slice(0, 1000);
        const nonPrintableCount = (sample.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
        if (nonPrintableCount / (sample.length || 1) < 0.05) {
          return { previewData: decoded, previewUrl: null, isDirect: true, category: 'text' };
        }
      } catch (_) {}
      return { previewData: null, previewUrl: null, isDirect: false, category: 'other' };
    }
  }
];

export class PreviewManager {
  constructor({ onClose } = {}) {
    this.onClose = onClose || (() => {});
    this.activeObjectUrls = new Set();
    this.currentPreview = null;
    this.registerUrl = this.registerUrl.bind(this);
  }

  registerUrl(url) {
    if (url) this.activeObjectUrls.add(url);
  }

  /**
   * Prepare a decrypted file for browser preview.
   * Allocates Object URLs for media or decodes text.
   */
  preparePreview(fileItem) {
    this.cleanup();

    const { name, size, type } = fileItem;
    const detection = detectFileType(name, type);
    let previewResult = {
      previewData: null,
      previewUrl: null,
      isDirect: detection.canPreviewDirectly,
      category: detection.category
    };

    for (const strategy of PREVIEW_STRATEGIES) {
      if (strategy.canHandle(detection, fileItem)) {
        previewResult = strategy.process(fileItem, detection, this.registerUrl);
        break;
      }
    }

    this.currentPreview = {
      fileName: name,
      fileSize: size,
      mimeType: type || detection.mime,
      category: previewResult.category || detection.category,
      label: detection.label || 'File',
      description: detection.description || '',
      canPreviewDirectly: previewResult.isDirect,
      content: previewResult.previewData,
      url: previewResult.previewUrl,
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
