/**
 * SecureShare Transfer Code Parser & Generator
 * Manages creation and parsing of FS- and SEC- transfer codes, URL fragments, and sharing messages.
 */

/**
 * Extract key from URL fragment or query parameter
 */
export function extractKeyFromUrl() {
  if (typeof window === 'undefined') return null;
  const searchParams = new URLSearchParams(window.location.search);
  const codeParam = searchParams.get('code');
  if (codeParam) {
    const parsed = parseTransferCode(codeParam);
    if (parsed.key) return parsed.key;
  }
  const hash = window.location.hash || '';
  const match = hash.match(/key=([^&]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Create a clean, readable Transfer Code
 * Format: FS-<FILE_ID>-<KEY> (e.g. FS-4BE819D7-9F8A73C2)
 */
export function createTransferCode(fileId, password) {
  const f = (fileId || '').toUpperCase();
  const p = (password || '').toUpperCase();
  return `FS-${f}-${p}`;
}

/**
 * Parse Transfer Code or flexible input formats (URL, FS-code, SEC-code, 16-char hex) into fileId and key
 */
export function parseTransferCode(input) {
  if (!input) return { fileId: null, key: null, valid: false };
  let str = input.trim();

  // Extract from full URL if pasted
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const url = new URL(str);
      const qCode = url.searchParams.get('code');
      if (qCode) {
        str = qCode;
      } else {
        const hashMatch = url.hash.match(/key=([^&]+)/);
        const urlKey = hashMatch ? decodeURIComponent(hashMatch[1]) : null;
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          if (lastPart !== 'download') {
            return {
              fileId: lastPart.toLowerCase(),
              key: urlKey ? urlKey.toLowerCase() : null,
              valid: Boolean(lastPart)
            };
          }
        }
      }
    } catch (_) {}
  }

  // Handle explicit prefixes: FS-, SEC-, FILE-
  const upper = str.toUpperCase();
  for (const prefix of ['FS-', 'FS:', 'SEC-', 'SEC:', 'FILE-', 'FILE:']) {
    if (upper.startsWith(prefix)) {
      const parts = str.slice(prefix.length).split(/[-:]/);
      if (parts.length >= 2) {
        return {
          fileId: parts[0].toLowerCase(),
          key: parts.slice(1).join('-').toLowerCase(),
          valid: true
        };
      } else if (parts.length === 1 && parts[0]) {
        return {
          fileId: parts[0].toLowerCase(),
          key: null,
          valid: true
        };
      }
    }
  }

  // Handle hyphenated format without prefix (e.g. 4BE819D7-9F8A73C2)
  if (str.includes('-') || str.includes(':')) {
    const parts = str.split(/[-:]/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        fileId: parts[0].toLowerCase(),
        key: parts.slice(1).join('-').toLowerCase(),
        valid: true
      };
    }
  }

  // Handle raw combined hex: 16+16 (current) or legacy 8+8
  const cleaned = str.replace(/[\s-]/g, '').toLowerCase();
  if (/^[0-9a-f]+$/.test(cleaned) && cleaned.length >= 32) {
    return {
      fileId: cleaned.slice(0, 16),
      key: cleaned.slice(16),
      valid: true
    };
  } else if (/^[0-9a-f]+$/.test(cleaned) && cleaned.length >= 16) {
    return {
      fileId: cleaned.slice(0, 8),
      key: cleaned.slice(8) || null,
      valid: true
    };
  } else if (cleaned.length >= 8) {
    return {
      fileId: cleaned.slice(0, 8),
      key: cleaned.slice(8) || null,
      valid: Boolean(cleaned)
    };
  }

  return {
    fileId: str.toLowerCase() || null,
    key: null,
    valid: Boolean(str)
  };
}

/**
 * Lightweight client-side format check. The server still validates IDs.
 */
export function isValidTransferCodeInput(input) {
  const parsed = parseTransferCode(input);
  if (!parsed.valid || !parsed.fileId) return false;
  return /^[0-9a-f]{8,32}$/.test(parsed.fileId);
}

/**
 * Format a comprehensive share message for messaging apps (WhatsApp, Telegram, Slack, etc.)
 */
export function createShareMessage({ transferCode, shareUrl, expiryHours, fileCount = 1, totalSize = '' }) {
  const parts = [
    'FileShare Transfer',
    `Code: ${transferCode}`,
  ];
  if (shareUrl) {
    parts.push(`Link: ${shareUrl}`);
  }
  if (expiryHours) {
    parts.push(`Expires: ${expiryHours} hour${expiryHours > 1 ? 's' : ''}`);
  }
  if (fileCount && totalSize) {
    parts.push(`Files: ${fileCount} file${fileCount > 1 ? 's' : ''} (${totalSize})`);
  }
  return parts.join('\n');
}

