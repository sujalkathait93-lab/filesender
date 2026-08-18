/**
 * File Type & Category Detection Module
 * Primary Responsibility: Classify files by extension and MIME type into canonical categories.
 */

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
export const CATEGORY_DETECTORS = [
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
