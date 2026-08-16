/**
 * FileShare Compression Module
 * CompressionStream & DecompressionStream wrappers (gzip)
 */

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
 * Decompress gzip data using DecompressionStream
 */
export async function decompressData(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(stream);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
