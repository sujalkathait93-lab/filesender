/**
 * FileShare File Manager Module (LLD: File Manager)
 * Responsible for selecting, validating, inspecting, and packaging files.
 * Supports single and multi-file transfers up to 1 GB total.
 * Refactored according to SOLID principles.
 */

export const MAX_TOTAL_TRANSFER_SIZE = 1 * 1024 * 1024 * 1024; // 1 GB

const BUNDLE_MAGIC = new Uint8Array([0x46, 0x53, 0x42, 0x55, 0x4e, 0x44, 0x4c, 0x31]); // "FSBUNDLE1"

// ─── Pre-computed Extension Sets (Open/Closed Principle & Performance) ─────
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'apng', 'jfif', 'pjpeg', 'pjp', 'tif', 'tiff'
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv', 'avi', 'wmv', 'flv', '3gp', '3g2', 'ts'
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma', 'mid', 'midi', 'aiff'
]);

const TEXT_EXTENSIONS = new Set([
  'txt', 'csv', 'tsv', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'pyw', 'html', 'htm', 'xhtml', 'css',
  'md', 'markdown', 'mdown', 'xml', 'log', 'yaml', 'yml', 'sh', 'bash', 'zsh', 'sql', 'env',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx', 'cs', 'java', 'rs', 'go', 'php', 'rb', 'swift',
  'kt', 'kts', 'dart', 'scala', 'r', 'lua', 'toml', 'ini', 'cfg', 'conf', 'dockerfile',
  'bat', 'cmd', 'ps1', 'psm1', 'graphql', 'gql', 'scss', 'sass', 'less', 'vue', 'svelte',
  'tex', 'rst', 'diff', 'patch', 'properties', 'reg', 'gitignore', 'gitattributes', 'lock', 'json5'
]);

const ARCHIVE_EXTENSIONS = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'zst', 'iso', 'cab', 'lz', 'lz4'
]);

const DOCUMENT_EXTENSIONS = new Set([
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'pages', 'numbers', 'key'
]);

const APP_EXTENSIONS = new Set([
  'exe', 'dmg', 'apk', 'msi', 'deb', 'rpm', 'bin', 'appimage', 'pkg'
]);

/**
 * Category detection strategies (Open/Closed Principle & Single Responsibility)
 */
const CATEGORY_DETECTORS = [
  {
    matches: (ext, mime) => IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/'),
    result: (ext, mime) => ({
      category: 'image',
      label: 'Image',
      ext,
      mime: mime || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      canPreviewDirectly: true,
      description: 'High-resolution in-browser image viewer.'
    })
  },
  {
    matches: (ext, mime) => VIDEO_EXTENSIONS.has(ext) || mime.startsWith('video/'),
    result: (ext, mime) => ({
      category: 'video',
      label: 'Video',
      ext,
      mime: mime || `video/${ext}`,
      canPreviewDirectly: true,
      description: 'In-browser video player with full playback controls.'
    })
  },
  {
    matches: (ext, mime) => AUDIO_EXTENSIONS.has(ext) || mime.startsWith('audio/'),
    result: (ext, mime) => ({
      category: 'audio',
      label: 'Audio',
      ext,
      mime: mime || `audio/${ext}`,
      canPreviewDirectly: true,
      description: 'In-browser streaming audio player.'
    })
  },
  {
    matches: (ext, mime) => ext === 'pdf' || mime === 'application/pdf',
    result: (ext) => ({
      category: 'pdf',
      label: 'PDF Document',
      ext,
      mime: 'application/pdf',
      canPreviewDirectly: true,
      description: 'Multi-page document preview.'
    })
  },
  {
    matches: (ext, mime) =>
      TEXT_EXTENSIONS.has(ext) ||
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('javascript') ||
      mime.includes('xml') ||
      mime.includes('yaml') ||
      mime.includes('sql') ||
      mime.includes('toml'),
    result: (ext, mime) => ({
      category: 'text',
      label: 'Source / Text',
      ext,
      mime: mime || 'text/plain',
      canPreviewDirectly: true,
      description: 'Syntax and monospace text viewer.'
    })
  },
  {
    matches: (ext, mime) =>
      ARCHIVE_EXTENSIONS.has(ext) ||
      mime.includes('zip') ||
      mime.includes('compressed') ||
      mime.includes('archive'),
    result: (ext, mime) => ({
      category: 'archive',
      label: 'Zip / Archive',
      ext,
      mime: mime || 'application/zip',
      canPreviewDirectly: false,
      description: 'Compressed archive. Download and extract on your device.'
    })
  },
  {
    matches: (ext) => DOCUMENT_EXTENSIONS.has(ext),
    result: (ext, mime) => ({
      category: 'document',
      label: 'Office Document',
      ext,
      mime: mime || 'application/octet-stream',
      canPreviewDirectly: false,
      description: 'Proprietary document. Download to open in office viewer.'
    })
  },
  {
    matches: (ext) => APP_EXTENSIONS.has(ext),
    result: (ext, mime) => ({
      category: 'app',
      label: 'Installer / App',
      ext,
      mime: mime || 'application/octet-stream',
      canPreviewDirectly: false,
      description: 'Application binary or disk image. Download to install.'
    })
  }
];

/**
 * Categorize a file by extension and MIME type for preview and display purposes.
 */
export function detectFileType(fileName = '', mimeType = '') {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  for (const detector of CATEGORY_DETECTORS) {
    if (detector.matches(ext, mime)) {
      return detector.result(ext, mime);
    }
  }

  return {
    category: 'other',
    label: 'Binary File',
    ext,
    mime: mime || 'application/octet-stream',
    canPreviewDirectly: false,
    description: 'Binary data. Download to view in your system viewer.'
  };
}

/**
 * Validate a selection of files against size limits (up to 1 GB total).
 */
export function validateFiles(files) {
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
    totalSize += size;
  }

  if (totalSize > MAX_TOTAL_TRANSFER_SIZE) {
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

/**
 * Format bytes into human-readable string (B, KB, MB, GB).
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Intelligent File Size Tier & Smart Transfer Optimization Analyzer (SRP: Smart file size categorization & guidance up to 1 GB)
 */
export function getFileSizeTier(bytes = 0) {
  if (!bytes || bytes <= 0) {
    return {
      tier: 'empty',
      label: 'No files selected',
      badgeClass: 'badge-slate',
      description: 'Select files up to 1 GB total.',
      suggestP2P: false,
      stegoRecommended: false,
      optimizationTip: 'Max payload 1 GB with zero-knowledge AES-256-GCM encryption.'
    };
  }

  const ONE_MB = 1024 * 1024;
  const TWENTY_FIVE_MB = 25 * ONE_MB;
  const ONE_HUNDRED_MB = 100 * ONE_MB;
  const FIVE_HUNDRED_MB = 500 * ONE_MB;
  const ONE_GB = 1024 * 1024 * 1024;

  if (bytes < ONE_MB) {
    return {
      tier: 'tiny',
      label: 'Tiny (< 1 MB)',
      badgeClass: 'badge-emerald',
      description: 'Instant transfer with zero server strain. Steganography Image Vault & Burn-on-Read recommended.',
      suggestP2P: false,
      stegoRecommended: true,
      optimizationTip: 'Sub-second client encryption • Steganography capable'
    };
  }

  if (bytes <= TWENTY_FIVE_MB) {
    return {
      tier: 'small',
      label: 'Small (1 – 25 MB)',
      badgeClass: 'badge-primary',
      description: 'Standard Cloud Encrypted transfer. Uploads and encrypts in under 1 second with automatic gzip compression.',
      suggestP2P: false,
      stegoRecommended: bytes <= 10 * ONE_MB,
      optimizationTip: 'High-speed cloud vault • Adaptive gzip compression'
    };
  }

  if (bytes <= ONE_HUNDRED_MB) {
    return {
      tier: 'medium',
      label: 'Medium (25 – 100 MB)',
      badgeClass: 'badge-cyan',
      description: 'Optimized Cloud Transfer with memory-safe 4 MB streaming encryption slices.',
      suggestP2P: false,
      stegoRecommended: false,
      optimizationTip: 'Chunked stream active • Constant low RAM footprint'
    };
  }

  if (bytes <= FIVE_HUNDRED_MB) {
    return {
      tier: 'large',
      label: 'Large (100 – 500 MB)',
      badgeClass: 'badge-amber',
      description: 'High-Speed Streaming Vault active. Memory-safe chunked pipeline (4 MB slices). Direct P2P available.',
      suggestP2P: false,
      stegoRecommended: false,
      optimizationTip: 'Stream & Batch memory pipeline • Zero browser freeze'
    };
  }

  if (bytes <= ONE_GB) {
    return {
      tier: 'ultra',
      label: 'Ultra (500 MB – 1 GB)',
      badgeClass: 'badge-purple',
      description: 'Approaching 1 GB capacity limit. Direct WebRTC P2P recommended for 0 server load & instant transfer, or continue with Streamed Cloud Vault.',
      suggestP2P: true,
      stegoRecommended: false,
      optimizationTip: 'Near 1 GB max • Direct P2P recommended for fastest transfer'
    };
  }

  return {
    tier: 'overlimit',
    label: 'Over Limit (> 1 GB)',
    badgeClass: 'badge-rose',
    description: 'Selected size exceeds the 1 GB cloud storage limit. Switch to WebRTC Direct P2P to transfer unlimited sizes device-to-device.',
    suggestP2P: true,
    stegoRecommended: false,
    optimizationTip: 'Exceeds 1 GB • WebRTC Direct P2P required'
  };
}

/**
 * Package single or multiple files into a unified binary stream.
 * If 1 file: returns file directly as primary.
 * If >1 files: packs into standard binary container with manifest header.
 */
export async function packFiles(files) {
  const fileArray = Array.from(files || []);
  if (fileArray.length === 0) throw new Error('No files to package');

  if (fileArray.length === 1) {
    return {
      isBundle: false,
      name: fileArray[0].name,
      size: fileArray[0].size,
      type: fileArray[0].type || 'application/octet-stream',
      blob: fileArray[0],
      fileCount: 1,
      fileList: [{ name: fileArray[0].name, size: fileArray[0].size, type: fileArray[0].type }]
    };
  }

  // Multi-file bundle
  const manifest = [];
  const blobs = [BUNDLE_MAGIC];

  for (const file of fileArray) {
    manifest.push({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream'
    });
  }

  const manifestJson = JSON.stringify({ version: 1, files: manifest });
  const manifestBytes = new TextEncoder().encode(manifestJson);

  // 4-byte little endian manifest length
  const manifestLengthBuffer = new Uint8Array(4);
  new DataView(manifestLengthBuffer.buffer).setUint32(0, manifestBytes.length, true);

  blobs.push(manifestLengthBuffer);
  blobs.push(manifestBytes);

  for (const file of fileArray) {
    blobs.push(file);
  }

  const bundleBlob = new Blob(blobs, { type: 'application/octet-stream' });
  const bundleName = `Bundle_${fileArray.length}_files.bundle`;

  return {
    isBundle: true,
    name: bundleName,
    size: bundleBlob.size,
    type: 'application/octet-stream',
    blob: bundleBlob,
    fileCount: fileArray.length,
    fileList: manifest
  };
}

/**
 * Check if binary data is a multi-file bundle.
 */
export function isBundleData(uint8Array) {
  if (!uint8Array || uint8Array.length < BUNDLE_MAGIC.length + 4) return false;
  for (let i = 0; i < BUNDLE_MAGIC.length; i++) {
    if (uint8Array[i] !== BUNDLE_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Unpack a decrypted Uint8Array into single or multiple files.
 */
export function unpackFiles(decryptedBytes, fallbackName = 'downloaded_file', fallbackMime = 'application/octet-stream') {
  if (!isBundleData(decryptedBytes)) {
    return {
      isBundle: false,
      files: [
        {
          name: fallbackName,
          size: decryptedBytes.byteLength,
          type: fallbackMime,
          data: decryptedBytes,
          blob: new Blob([decryptedBytes], { type: fallbackMime })
        }
      ]
    };
  }

  // Parse multi-file bundle
  const view = new DataView(decryptedBytes.buffer, decryptedBytes.byteOffset, decryptedBytes.byteLength);
  let offset = BUNDLE_MAGIC.length;

  const manifestLength = view.getUint32(offset, true);
  offset += 4;

  const manifestJsonBytes = decryptedBytes.slice(offset, offset + manifestLength);
  offset += manifestLength;

  const manifestStr = new TextDecoder().decode(manifestJsonBytes);
  const manifest = JSON.parse(manifestStr);

  const files = [];
  for (const item of manifest.files) {
    const fileBytes = decryptedBytes.slice(offset, offset + item.size);
    offset += item.size;

    files.push({
      name: item.name,
      size: item.size,
      type: item.type || 'application/octet-stream',
      data: fileBytes,
      blob: new Blob([fileBytes], { type: item.type || 'application/octet-stream' })
    });
  }

  return {
    isBundle: true,
    files
  };
}
