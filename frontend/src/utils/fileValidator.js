/**
 * File Selection & Size Validator
 * Primary Responsibility: Enforce single-file and batch size limits against transfer capacities.
 */

import { SmartTransferOptimizer, MAX_FILE_SIZE_BYTES } from '../services/smartTransferOptimizer.js';

export const MAX_TOTAL_TRANSFER_SIZE = MAX_FILE_SIZE_BYTES; // 1 GB

/**
 * Validate a selection of files against size limits (1 GB max per individual file & total).
 */
export function validateFiles(files, maxTotalLimit = MAX_TOTAL_TRANSFER_SIZE) {
  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) {
    return { valid: false, totalSize: 0, error: 'No files selected', files: [] };
  }

  let totalSize = 0;
  for (const f of fileArray) {
    const size = f.size || 0;
    if (size < 0) {
      return { valid: false, totalSize, error: `Invalid file size for ${f.name}`, files: [] };
    }

    // Immediate individual file size validation (1 GB max)
    const singleValidation = SmartTransferOptimizer.validateFile(f);
    if (!singleValidation.valid) {
      return {
        valid: false,
        totalSize: totalSize + size,
        error: singleValidation.error,
        code: singleValidation.code,
        rejectedFile: f,
        files: fileArray
      };
    }

    totalSize += size;
  }

  if (maxTotalLimit && maxTotalLimit > 0 && totalSize > maxTotalLimit) {
    const sizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
    return {
      valid: false,
      totalSize,
      error: `Total file size (${sizeGB} GB) exceeds maximum allowed limit of 1 GB.`,
      files: fileArray
    };
  }

  return {
    valid: true,
    totalSize,
    error: null,
    files: fileArray
  };
}
