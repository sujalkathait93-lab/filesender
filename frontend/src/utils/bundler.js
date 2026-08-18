/**
 * Multi-File Bundle Packaging & Unpacking Module
 * Primary Responsibility: Pack multiple files into a binary container with header manifest, and unpack on receiver.
 */

export const BUNDLE_MAGIC = new Uint8Array([0x46, 0x53, 0x42, 0x55, 0x4e, 0x44, 0x4c, 0x31]); // "FSBUNDLE1"

/**
 * Check if binary data starts with the multi-file bundle magic bytes.
 */
export function isBundleData(uint8Array) {
  if (!uint8Array || uint8Array.length < BUNDLE_MAGIC.length + 4) return false;
  for (let i = 0; i < BUNDLE_MAGIC.length; i++) {
    if (uint8Array[i] !== BUNDLE_MAGIC[i]) return false;
  }
  return true;
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
