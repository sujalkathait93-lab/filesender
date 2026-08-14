/**
 * SecureShare Transfer Code Parser & Generator
 * Manages creation and parsing of SEC-transfer codes and URL fragments.
 */

/**
 * Extract key from URL fragment or query parameter
 */
export function extractKeyFromUrl() {
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
 * Create a clean short Crypto Transfer Code
 * Format: SEC-<FILE_ID>-<KEY> (e.g. SEC-4BE819D7-9F8A73C2)
 */
export function createTransferCode(fileId, password) {
  const f = (fileId || '').toUpperCase();
  const p = (password || '').toUpperCase();
  return `SEC-${f}-${p}`;
}

/**
 * Parse Crypto Transfer Code or flexible input formats (URL, SEC-code, 16-char hex) into fileId and key
 */
export function parseTransferCode(input) {
  if (!input) return { fileId: null, key: null };
  let str = input.trim();

  // Extract from full URL if pasted
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const url = new URL(str);
      const qCode = url.searchParams.get('code');
      if (qCode) {
        str = qCode;
      } else {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          str = pathParts[pathParts.length - 1];
        }
      }
    } catch (_) {}
  }

  // Handle explicit SEC-fileId-key format
  if (str.toUpperCase().startsWith('SEC-') || str.toUpperCase().startsWith('SEC:')) {
    const parts = str.slice(4).split(/[-:]/);
    if (parts.length >= 2) {
      return { fileId: parts[0].toLowerCase(), key: parts.slice(1).join('-').toLowerCase() };
    }
  }

  // Handle raw 16-character combined hex code (8 chars fileId + 8 chars key)
  const cleaned = str.replace(/[\s-]/g, '').toLowerCase();
  if (cleaned.length >= 16) {
    return { fileId: cleaned.slice(0, 8), key: cleaned.slice(8) };
  } else if (cleaned.length >= 8) {
    return { fileId: cleaned.slice(0, 8), key: cleaned.slice(8) || null };
  }

  return { fileId: str.toLowerCase(), key: null };
}
