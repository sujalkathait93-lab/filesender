/**
 * FileShare File Manager Module (LLD: File Manager)
 * Responsible for selecting, validating, inspecting, and packaging files.
 * Supports single and multi-file transfers up to 2 GB total.
 */

export const MAX_TOTAL_TRANSFER_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

const BUNDLE_MAGIC = new Uint8Array([0x46, 0x53, 0x42, 0x55, 0x4e, 0x44, 0x4c, 0x31]); // "FSBUNDLE1"

/**
 * Categorize a file by extension and MIME type for preview and display purposes.
 */
export function detectFileType(fileName = '', mimeType = '') {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'apng', 'jfif', 'pjpeg', 'pjp', 'tif', 'tiff'];
  const videoExts = ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv', 'avi', 'wmv', 'flv', '3gp', '3g2', 'ts'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma', 'mid', 'midi', 'aiff'];
  const textExts = [
    'txt', 'csv', 'tsv', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'pyw', 'html', 'htm', 'xhtml', 'css',
    'md', 'markdown', 'mdown', 'xml', 'log', 'yaml', 'yml', 'sh', 'bash', 'zsh', 'sql', 'env',
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx', 'cs', 'java', 'rs', 'go', 'php', 'rb', 'swift',
    'kt', 'kts', 'dart', 'scala', 'r', 'lua', 'toml', 'ini', 'cfg', 'conf', 'dockerfile',
    'bat', 'cmd', 'ps1', 'psm1', 'graphql', 'gql', 'scss', 'sass', 'less', 'vue', 'svelte',
    'tex', 'rst', 'diff', 'patch', 'properties', 'reg', 'gitignore', 'gitattributes', 'lock', 'json5'
  ];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'zst', 'iso', 'cab', 'lz', 'lz4'];
  const docExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'pages', 'numbers', 'key'];
  const appExts = ['exe', 'dmg', 'apk', 'msi', 'deb', 'rpm', 'bin', 'appimage', 'pkg'];

  if (imageExts.includes(ext) || mime.startsWith('image/')) {
    return {
      category: 'image',
      label: 'Image',
      ext,
      mime: mime || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      canPreviewDirectly: true,
      description: 'High-resolution in-browser image viewer.'
    };
  }
  if (videoExts.includes(ext) || mime.startsWith('video/')) {
    return {
      category: 'video',
      label: 'Video',
      ext,
      mime: mime || `video/${ext}`,
      canPreviewDirectly: true,
      description: 'In-browser video player with full playback controls.'
    };
  }
  if (audioExts.includes(ext) || mime.startsWith('audio/')) {
    return {
      category: 'audio',
      label: 'Audio',
      ext,
      mime: mime || `audio/${ext}`,
      canPreviewDirectly: true,
      description: 'In-browser streaming audio player.'
    };
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      category: 'pdf',
      label: 'PDF Document',
      ext,
      mime: 'application/pdf',
      canPreviewDirectly: true,
      description: 'Multi-page document preview.'
    };
  }
  if (
    textExts.includes(ext) ||
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('xml') ||
    mime.includes('yaml') ||
    mime.includes('sql') ||
    mime.includes('toml')
  ) {
    return {
      category: 'text',
      label: 'Source / Text',
      ext,
      mime: mime || 'text/plain',
      canPreviewDirectly: true,
      description: 'Syntax and monospace text viewer.'
    };
  }
  if (archiveExts.includes(ext) || mime.includes('zip') || mime.includes('compressed') || mime.includes('archive')) {
    return {
      category: 'archive',
      label: 'Zip / Archive',
      ext,
      mime: mime || 'application/zip',
      canPreviewDirectly: false,
      description: 'Compressed archive. Browsers cannot render ZIP contents directly; click below to download and extract on your device.'
    };
  }
  if (docExts.includes(ext)) {
    return {
      category: 'document',
      label: 'Office Document',
      ext,
      mime: mime || 'application/octet-stream',
      canPreviewDirectly: false,
      description: 'Proprietary document. Download to open in Microsoft Office, Google Docs, or LibreOffice.'
    };
  }
  if (appExts.includes(ext)) {
    return {
      category: 'app',
      label: 'Installer / App',
      ext,
      mime: mime || 'application/octet-stream',
      canPreviewDirectly: false,
      description: 'Application binary or disk image. Download to install or mount on your operating system.'
    };
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
 * Validate a selection of files against size limits (up to 2 GB total).
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
      error: `Total file size (${sizeGB} GB) exceeds maximum allowed limit of 2 GB.`,
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
  let offset = 0;

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
