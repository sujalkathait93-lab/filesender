/**
 * SecureShare Hex Utilities
 * Utility functions to convert between hex strings and Uint8Arrays.
 */

export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hexString) {
  if (!hexString) return null;
  const matches = hexString.match(/.{2}/g);
  if (!matches) return null;
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}
