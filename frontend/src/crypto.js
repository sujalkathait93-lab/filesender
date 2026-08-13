/**
 * SecureShare Crypto Module
 * Client-side E2E Encryption using Web Crypto API
 * AES-256-GCM + PBKDF2 + CompressionStream
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Generate a random encryption key and derive AES key
 */
export async function generateKey() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  // Generate 4 random bytes -> 8 hex characters for short password
  const password = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, iv, salt, password };
}

/**
 * Derive key from password + salt
 */
export async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate unique IV for each chunk based on base IV and chunkIndex counter
 */
export function getChunkIV(baseIV, chunkIndex) {
  const iv = new Uint8Array(baseIV);
  const view = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
  const currentVal = view.getUint32(8, false);
  view.setUint32(8, (currentVal + chunkIndex) >>> 0, false);
  return iv;
}

/**
 * Encrypt individual chunk with unique chunk IV
 */
export async function encryptChunkData(chunkArrayBuffer, key, baseIV, chunkIndex) {
  const iv = getChunkIV(baseIV, chunkIndex);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    chunkArrayBuffer
  );
  return new Uint8Array(encrypted);
}

/**
 * Decrypt individual chunk with unique chunk IV
 */
export async function decryptChunkData(encryptedChunkBuffer, key, baseIV, chunkIndex) {
  const iv = getChunkIV(baseIV, chunkIndex);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encryptedChunkBuffer
  );
  return new Uint8Array(decrypted);
}

/**
 * Compress data using CompressionStream (gzip)
 */
export async function compressData(data) {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
  const response = new Response(stream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Decompress gzip data
 */
export async function decompressData(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(stream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Encrypt file: compress then encrypt
 */
export async function encryptFile(file, onProgress) {
  // Read file
  const arrayBuffer = await file.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);

  onProgress?.({ stage: 'compressing', percent: 10 });

  // Compress first
  const compressed = await compressData(fileData);
  const compressionRatio = fileData.length > 0
    ? ((1 - compressed.length / fileData.length) * 100).toFixed(1)
    : '0.0';

  onProgress?.({ stage: 'encrypting', percent: 40, compressionRatio });

  // Generate key
  const { key, iv, salt, password } = await generateKey();

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    compressed
  );

  onProgress?.({ stage: 'encrypted', percent: 80 });

  return {
    encryptedBlob: new Blob([encrypted]),
    originalSize: fileData.length,
    encryptedSize: encrypted.byteLength,
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
    password,
    compressionRatio
  };
}

/**
 * Decrypt file: download, decrypt, decompress
 */
export async function decryptFile(encryptedBlob, password, ivHex, saltHex, onProgress) {
  onProgress?.({ stage: 'downloading', percent: 20 });

  const encryptedData = new Uint8Array(await encryptedBlob.arrayBuffer());

  onProgress?.({ stage: 'decrypting', percent: 50 });

  if (!ivHex || !saltHex) {
    throw new Error('Invalid file metadata: IV or Salt is missing');
  }

  const ivMatches = ivHex.match(/.{2}/g);
  const saltMatches = saltHex.match(/.{2}/g);
  if (!ivMatches || !saltMatches) {
    throw new Error('Invalid file metadata: Invalid IV or Salt format');
  }

  // Parse IV and salt
  const iv = new Uint8Array(ivMatches.map(byte => parseInt(byte, 16)));
  const salt = new Uint8Array(saltMatches.map(byte => parseInt(byte, 16)));

  // Derive key
  const key = await deriveKey(password, salt);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encryptedData
  );

  onProgress?.({ stage: 'decompressing', percent: 80 });

  // Decompress
  const decompressed = await decompressData(new Uint8Array(decrypted));

  onProgress?.({ stage: 'complete', percent: 100 });

  return decompressed;
}

/**
 * Create share URL with full crypto code as query parameter or path parameter
 */
export function createShareUrl(fileId, password, serverUrl) {
  const base = serverUrl || window.location.origin;
  const code = createTransferCode(fileId, password);
  return `${base}/download?code=${encodeURIComponent(code)}`;
}

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

  // Extract from full URL if pasted (e.g. http://localhost:5173/download?code=SEC-12345678-ABCDEF12 or http://localhost:5173/download/SEC-12345678-ABCDEF12)
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

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}
