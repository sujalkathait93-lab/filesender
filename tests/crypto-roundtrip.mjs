/**
 * Round-trip test for the memory-safe chunked crypto format (runs in Node 22).
 * Bundled with esbuild because the source uses extensionless ESM imports.
 */
import { encryptFile, decryptFile, buildChunkMarker, isChunkedMarker } from '../frontend/src/crypto.js';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
}

function randomBytes(n) {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) {
    const chunk = new Uint8Array(Math.min(65536, n - i));
    globalThis.crypto.getRandomValues(chunk);
    buf.set(chunk, i);
  }
  return buf;
}

async function main() {
  // 1. Large file (10 MB) -> chunked format
  const big = randomBytes(10 * 1024 * 1024);
  const bigFile = new File([big], 'big.bin', { type: 'application/octet-stream' });
  const enc = await encryptFile(bigFile);
  check('large file uses chunked format', enc.chunked === true);
  check('marker correct', buildChunkMarker(enc.chunked) === `chunked:4194304`);
  check('isChunkedMarker detects', isChunkedMarker('chunked:4194304') === true);
  check('isChunkedMarker rejects legacy', isChunkedMarker('') === false);

  const decBig = await decryptFile(enc.encryptedBlob, enc.password, enc.iv, enc.salt, null, true, enc.compressed);
  check('large file round-trips byte-identical', decBig.length === big.length && decBig.every((b, i) => b === big[i]));
  check('password is valid hex string', /^[0-9a-f]{5,16}$/.test(enc.password));

  // 2. Small file (1 KB) -> legacy single-shot format
  const small = randomBytes(1024);
  const smallFile = new File([small], 'small.bin');
  const encSmall = await encryptFile(smallFile);
  check('small file uses legacy format', encSmall.chunked === false);

  const decSmallLegacy = await decryptFile(encSmall.encryptedBlob, encSmall.password, encSmall.iv, encSmall.salt, null, false, encSmall.compressed);
  check('small file round-trips (legacy path)', decSmallLegacy.length === small.length && decSmallLegacy.every((b, i) => b === small[i]));

  // 3. Wrong password must fail decryption (integrity check)
  let failed = false;
  try {
    await decryptFile(enc.encryptedBlob, '00000000', enc.iv, enc.salt, null, true);
  } catch (e) {
    failed = true;
  }
  check('wrong password fails with GCM error', failed);

  // 4. Chunk size boundary: 4 MB + 1 byte (forces 2 chunks)
  const edge = randomBytes(4 * 1024 * 1024 + 1);
  const edgeFile = new File([edge], 'edge.bin');
  const encEdge = await encryptFile(edgeFile);
  const decEdge = await decryptFile(encEdge.encryptedBlob, encEdge.password, encEdge.iv, encEdge.salt, null, true, encEdge.compressed);
  check('boundary file (4MB+1) round-trips', decEdge.length === edge.length && decEdge.every((b, i) => b === edge[i]));

  const failedCount = results.filter((r) => !r.ok).length;
  console.log(`\n== ${results.length - failedCount}/${results.length} passed ==`);
  process.exit(failedCount ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});