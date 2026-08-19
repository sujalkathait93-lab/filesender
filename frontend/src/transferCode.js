/**
 * SecureShare Transfer Code Parser & Generator
 * Manages creation and parsing of 10-digit transfer codes, URL fragments, and sharing messages.
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
    return decodeURIComponent(match[1]).toLowerCase();
  }
  return null;
}

/**
 * Create a clean, readable 10-digit Transfer Code
 * Format: FS-<5-char ID>-<5-char Key> (e.g. FS-4BE81-9F8A7 or FS-12345-67890)
 * Total code payload is exactly 10 digits (formatted as 5-5 for ease of typing).
 */
export function createTransferCode(fileId, password) {
  const f = (fileId || '').toUpperCase();
  const p = (password || '').toUpperCase();
  return `FS-${f}-${p}`;
}

/**
 * Parse 10-digit Transfer Code or flexible input formats (URL, FS-code, SEC-code, 10-digit, 16-char hex) into fileId and key
 */
export function parseTransferCode(input) {
  if (!input) return { fileId: null, key: null, valid: false };
  let str = input.trim();
  let urlKey = null;

  const result = (fileId, key, valid) => ({
    fileId,
    key: key || urlKey,
    valid
  });

  // Extract from full URL if pasted
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const url = new URL(str);
      const hashMatch = url.hash.match(/key=([^&]+)/);
      urlKey = hashMatch ? decodeURIComponent(hashMatch[1]).toLowerCase() : null;
      const qCode = url.searchParams.get('code');
      if (qCode) {
        str = qCode;
      } else {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          if (lastPart !== 'download') {
            return result(lastPart.toLowerCase(), null, Boolean(lastPart));
          }
        }
      }
    } catch (_) {}
  }

  // Handle explicit prefixes: FS-, FS:, SEC-, SEC:, FILE-, FILE:
  const upper = str.toUpperCase();
  for (const prefix of ['FS-', 'FS:', 'SEC-', 'SEC:', 'FILE-', 'FILE:']) {
    if (upper.startsWith(prefix)) {
      const remainder = str.slice(prefix.length).trim();
      const parts = remainder.split(/[-:]/);
      if (parts.length >= 2) {
        return result(parts[0].toLowerCase(), parts.slice(1).join('-').toLowerCase(), true);
      } else if (parts.length === 1 && parts[0]) {
        // Handle raw 10-digit / 16-hex code with prefix (e.g. FS-4BE819F8A7)
        const cleanedRemainder = parts[0].replace(/[\s-]/g, '').toLowerCase();
        if (/^[0-9a-f]+$/.test(cleanedRemainder)) {
          if (cleanedRemainder.length === 10) {
            return result(cleanedRemainder.slice(0, 5), cleanedRemainder.slice(5), true);
          } else if (cleanedRemainder.length === 16) {
            return result(cleanedRemainder.slice(0, 8), cleanedRemainder.slice(8), true);
          } else if (cleanedRemainder.length >= 32) {
            return result(cleanedRemainder.slice(0, 16), cleanedRemainder.slice(16), true);
          }
        }
        return result(parts[0].toLowerCase(), null, true);
      }
    }
  }

  // Handle hyphenated format without prefix (e.g. 4BE81-9F8A7 or 12345-67890 or 4BE819D7-9F8A73C2)
  if (str.includes('-') || str.includes(':')) {
    const parts = str.split(/[-:]/).filter(Boolean);
    if (parts.length >= 2) {
      return result(parts[0].toLowerCase(), parts.slice(1).join('-').toLowerCase(), true);
    }
  }

  // Handle raw combined digits / hex (no hyphens)
  const cleaned = str.replace(/[\s-]/g, '').toLowerCase();
  if (/^[0-9a-f]+$/.test(cleaned)) {
    // 10-digit transfer code (5 file ID + 5 key)
    if (cleaned.length === 10) {
      return result(cleaned.slice(0, 5), cleaned.slice(5), true);
    }
    // 16-hex legacy code (8 file ID + 8 key)
    if (cleaned.length === 16) {
      return result(cleaned.slice(0, 8), cleaned.slice(8), true);
    }
    // 32-hex legacy code (16 file ID + 16 key)
    if (cleaned.length >= 32) {
      return result(cleaned.slice(0, 16), cleaned.slice(16), true);
    }
    // 5-digit raw file ID
    if (cleaned.length === 5) {
      return result(cleaned, null, true);
    }
    // 8-digit raw file ID
    if (cleaned.length >= 8) {
      return result(cleaned.slice(0, 8), cleaned.slice(8) || null, Boolean(cleaned));
    }
  }

  return result(str.toLowerCase() || null, null, Boolean(str));
}

/**
 * Lightweight client-side format check. The server still validates IDs.
 */
export function isValidTransferCodeInput(input) {
  const parsed = parseTransferCode(input);
  if (!parsed.valid || !parsed.fileId) return false;
  return /^[0-9a-fA-F]{4,32}$/.test(parsed.fileId);
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
    const mins = Math.round(expiryHours * 60);
    parts.push(`Expires: ${mins} minutes`);
  }
  if (fileCount && totalSize) {
    parts.push(`Files: ${fileCount} file${fileCount > 1 ? 's' : ''} (${totalSize})`);
  }
  return parts.join('\n');
}
