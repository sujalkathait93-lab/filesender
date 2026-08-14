/**
 * SecureShare Crypto Module
 * Client-side E2E Encryption using Web Crypto API
 * AES-256-GCM + PBKDF2 + gzip
 *
 * Memory-safe large files:
 * Files larger than CHUNK_SIZE are encrypted chunk-by-chunk. Each chunk is
 * read with file.slice() (streamed from disk), gzip-compressed, and encrypted
 * with a counter-derived per-chunk IV (getChunkIV). The ciphertext stream is
 * self-describing: every chunk is prefixed with a 4-byte little-endian length,
 * so decoding never needs the full file in memory and is immune to gzip
 * output-size variability.
 *
 * The format marker is stored server-side in the files.checksum column
 * ("chunked:4194304"); an empty marker means legacy single-shot format,
 * which decryptFile still supports for backwards compatibility.
 */

import { bytesToHex, hexToBytes } from './hexUtils.js';
import { compressData, decompressData } from './compression.js';

// Re-export for convenience & backwards compatibility
export { extractKeyFromUrl, createTransferCode, parseTransferCode } from './transferCode.js';
export { formatBytes } from './utils/format.js';
export { copyToClipboard } from './utils/clipboard.js';
export { compressData, decompressData } from './compression.js';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/** Chunk size for memory-safe large-file encryption. */
export const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

/** Build the server-side checksum marker for a chunked upload ('' = legacy format). */
export function buildChunkMarker(chunked) {
  return chunked ? `chunked:${CHUNK_SIZE}` : '';
}

/** True when a checksum marker indicates the chunked ciphertext format. */
export function isChunkedMarker(checksum) {
  return typeof checksum === 'string' && checksum.startsWith('chunked:');
}

/**
 * Generate a random encryption key and derive AES key
 */
export async function generateKey() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  // Generate 4 random bytes -> 8 hex characters for short password
  const password = bytesToHex(crypto.getRandomValues(new Uint8Array(4)));

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
 * Encrypt file: stream slices -> gzip -> AES-GCM chunk by chunk.
 * Memory usage stays near CHUNK_SIZE regardless of file size.
 * onProgress receives { stage, percent, compressionRatio? }.
 */
export async function encryptFile(file, onProgress) {
  const totalSize = file.size;
  const { key, iv, salt, password } = await generateKey();

  onProgress?.({ stage: 'compressing', percent: 10 });

  const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));
  const chunked = totalChunks > 1;
  const parts = [];
  let encryptedSize = 0;
  let compressionRatio = '0.0';

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const raw = new Uint8Array(await file.slice(start, end).arrayBuffer());

    const compressed = await compressData(raw);
    if (i === 0 && raw.length > 0) {
      compressionRatio = ((1 - compressed.length / raw.length) * 100).toFixed(1);
    }

    const encrypted = await encryptChunkData(compressed.buffer, key, iv, i);

    if (chunked) {
      // 4-byte little-endian length header makes the stream self-describing.
      // Single-chunk files stay in the legacy format (no header).
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, encrypted.length, true);
      parts.push(header);
      encryptedSize += 4;
    }

    parts.push(encrypted);
    encryptedSize += encrypted.byteLength;

    onProgress?.({ stage: 'encrypting', percent: 30 + Math.round(((i + 1) / totalChunks) * 60) });
  }

  onProgress?.({ stage: 'encrypted', percent: 95 });

  return {
    encryptedBlob: new Blob(parts),
    originalSize: totalSize,
    encryptedSize,
    iv: bytesToHex(iv),
    salt: bytesToHex(salt),
    password,
    compressionRatio,
    chunked,
  };
}

/**
 * Decrypt file: read ciphertext -> AES-GCM decrypt + gunzip per chunk.
 * Supports both the chunked format (checksum marker) and legacy single-shot.
 */
export async function decryptFile(encryptedBlob, password, ivHex, saltHex, onProgress, chunked = false) {
  if (!ivHex || !saltHex) {
    throw new Error('Invalid file metadata: IV or Salt is missing');
  }

  const iv = hexToBytes(ivHex);
  const salt = hexToBytes(saltHex);
  if (!iv || !salt) {
    throw new Error('Invalid file metadata: Invalid IV or Salt format');
  }

  onProgress?.({ stage: 'decrypting', percent: 40 });

  const key = await deriveKey(password, salt);

  if (chunked) {
    const totalBytes = encryptedBlob.size;
    const decryptedParts = [];
    let outputLength = 0;
    let offset = 0;
    let chunkIndex = 0;

    while (offset < totalBytes) {
      const header = new Uint8Array(await encryptedBlob.slice(offset, offset + 4).arrayBuffer());
      const chunkLength = new DataView(header.buffer).getUint32(0, true);
      offset += 4;

      const cipherChunk = await encryptedBlob.slice(offset, offset + chunkLength).arrayBuffer();
      offset += chunkLength;

      const decrypted = await decryptChunkData(cipherChunk, key, iv, chunkIndex);
      const raw = await decompressData(decrypted);
      decryptedParts.push(raw);
      outputLength += raw.length;
      chunkIndex++;

      onProgress?.({ stage: 'decrypting', percent: 40 + Math.round((offset / totalBytes) * 55) });
    }

    onProgress?.({ stage: 'complete', percent: 100 });
    return concatBytes(decryptedParts, outputLength);
  }

  // Legacy single-shot format
  onProgress?.({ stage: 'decrypting', percent: 50 });
  const encryptedData = new Uint8Array(await encryptedBlob.arrayBuffer());
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, encryptedData);
  onProgress?.({ stage: 'decompressing', percent: 80 });
  const decompressed = await decompressData(new Uint8Array(decrypted));
  onProgress?.({ stage: 'complete', percent: 100 });
  return decompressed;
}

/** Concatenate Uint8Array parts into one buffer with a single allocation. */
function concatBytes(parts, totalLength) {
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
