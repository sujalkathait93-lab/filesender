/**
 * FileShare File Manager Façade (LLD: File Manager)
 *
 * Re-exports file detection, validation, packaging, and sizing utilities
 * from dedicated single-responsibility submodules.
 */

// Category & MIME detection
export { detectFileType, CATEGORY_DETECTORS } from './utils/fileType.js';

// Bundle packaging & unpacking
export { packFiles, unpackFiles, isBundleData, BUNDLE_MAGIC } from './utils/bundler.js';

// Selection & size validation
export { validateFiles, MAX_TOTAL_TRANSFER_SIZE, MAX_FILES_PER_TRANSFER } from './utils/fileValidator.js';

// File size tier & guidance
export { getFileSizeTier } from './utils/fileTier.js';

// Formatting
export { formatBytes } from './utils/format.js';

// Smart Transfer Optimizer re-export
export { SmartTransferOptimizer, MAX_FILE_SIZE_BYTES } from './services/smartTransferOptimizer.js';
