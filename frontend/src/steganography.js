/**
 * FileShare Steganography Module
 * Encodes/decodes binary payloads directly into Canvas ImageData pixel channels (LSB)
 */

const MAGIC_HEADER = [83, 69, 67, 86, 65, 85, 76, 84, 118, 49]; // "SECVAULTv1"

// Browsers choke on canvases wider than ~5000px (memory + max dimension limits).
// 5000px wide at 4:3 is ~26.7M pixels, enough for roughly a 10 MB payload.
const MAX_COVER_WIDTH = 5000;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Auto-generate a beautiful dark space artwork cover image on canvas
 */
export function createDefaultCoverCanvas(width = 600, height = 400) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Deep space gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Glowing nebula circles
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 30 + Math.random() * 90;
    const colorGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    colorGrad.addColorStop(0, i % 2 === 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.2)');
    colorGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = colorGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Abstract grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vault badge watermark text
  ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.font = '600 14px monospace';
  ctx.fillText('FILESHARE STEGANO VAULT', 20, height - 20);

  return canvas;
}

/**
 * Embed payload (Uint8Array) into an Image (File/Blob or Canvas)
 * Uses LSB (Least Significant Bit) replacement across R, G, B channels.
 */
export async function embedPayloadInImage(coverImageFile, payloadBytes) {
  let imgCanvas;
  
  if (coverImageFile) {
    const img = new Image();
    const url = URL.createObjectURL(coverImageFile);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);

    imgCanvas = document.createElement('canvas');
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const ctx = imgCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
  } else {
    // Determine canvas size needed for payload
    // Header (10B) + Length (4B) + Payload = Total Bytes
    const totalBytesNeeded = MAGIC_HEADER.length + 4 + payloadBytes.length;
    // Each pixel RGB channels hold 3 bits
    const pixelsNeeded = Math.ceil((totalBytesNeeded * 8) / 3) + 5000;
    // For 4:3 aspect ratio: width * (0.75 * width) >= pixelsNeeded => width >= sqrt(pixelsNeeded / 0.75)
    const width = Math.max(800, Math.ceil(Math.sqrt(pixelsNeeded / 0.75)));

    if (payloadBytes.length > MAX_PAYLOAD_BYTES || width > MAX_COVER_WIDTH) {
      throw new Error(
        'Payload too large for the steganographic image vault (max ~10 MB). ' +
        'Upload it as a regular encrypted file instead - encryption is identical.'
      );
    }

    const height = Math.ceil(width * 0.75);
    imgCanvas = createDefaultCoverCanvas(width, height);
  }

  const ctx = imgCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
  const pixels = imgData.data;

  // Construct full payload buffer: MAGIC_HEADER (10) + Length (4) + Payload
  const fullBuffer = new Uint8Array(MAGIC_HEADER.length + 4 + payloadBytes.length);
  fullBuffer.set(MAGIC_HEADER, 0);

  const len = payloadBytes.length;
  fullBuffer[10] = (len >> 24) & 0xff;
  fullBuffer[11] = (len >> 16) & 0xff;
  fullBuffer[12] = (len >> 8) & 0xff;
  fullBuffer[13] = len & 0xff;

  fullBuffer.set(payloadBytes, 14);

  // Check capacity
  const maxBytesCapacity = Math.floor((pixels.length / 4 * 3) / 8);
  if (fullBuffer.length > maxBytesCapacity) {
    throw new Error(`Cover image too small to hold file. Max capacity: ${Math.floor(maxBytesCapacity / 1024)} KB`);
  }

  // Embed bit by bit into LSB of R, G, B channels (ignoring A channel at idx % 4 === 3)
  let bitIndex = 0;
  const totalBits = fullBuffer.length * 8;

  for (let i = 0; i < pixels.length && bitIndex < totalBits; i++) {
    if (i % 4 === 3) continue; // Skip Alpha channel

    const byteIdx = Math.floor(bitIndex / 8);
    const bitPos = 7 - (bitIndex % 8);
    const bit = (fullBuffer[byteIdx] >> bitPos) & 1;

    // Clear LSB and set to payload bit
    pixels[i] = (pixels[i] & 0xfe) | bit;
    bitIndex++;
  }

  ctx.putImageData(imgData, 0, 0);

  // Return Blob (PNG to preserve exact pixel values)
  return new Promise(resolve => {
    imgCanvas.toBlob(blob => resolve(blob), 'image/png');
  });
}

/**
 * Extract payload from a Steganographic PNG image Blob/File
 */
export async function extractPayloadFromImage(imageFileOrBlob) {
  const img = new Image();
  const url = URL.createObjectURL(imageFileOrBlob);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image for steganography extraction'));
    img.src = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // Extract Magic Header + Length (14 bytes = 112 bits)
  let bitIndex = 0;
  const headerBuffer = new Uint8Array(14);
  for (let i = 0; i < pixels.length && bitIndex < 112; i++) {
    if (i % 4 === 3) continue;

    const bit = pixels[i] & 1;
    const byteIdx = Math.floor(bitIndex / 8);
    const bitPos = 7 - (bitIndex % 8);
    
    headerBuffer[byteIdx] |= (bit << bitPos);
    bitIndex++;
  }

  // Verify Magic Header
  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (headerBuffer[i] !== MAGIC_HEADER[i]) {
      throw new Error('No Steganographic Vault payload found in this image');
    }
  }

  // Read payload length (4 bytes)
  const payloadLen = ((headerBuffer[10] << 24) |
                      (headerBuffer[11] << 16) |
                      (headerBuffer[12] << 8) |
                      headerBuffer[13]) >>> 0;

  if (payloadLen <= 0 || payloadLen > 500 * 1024 * 1024) {
    throw new Error('Invalid steganography payload length detected');
  }

  // Read full payload including header + length + data
  const totalBytesNeeded = 14 + payloadLen;
  const totalBitsNeeded = totalBytesNeeded * 8;
  const fullBuffer = new Uint8Array(totalBytesNeeded);

  bitIndex = 0;
  for (let i = 0; i < pixels.length && bitIndex < totalBitsNeeded; i++) {
    if (i % 4 === 3) continue;

    const bit = pixels[i] & 1;
    const byteIdx = Math.floor(bitIndex / 8);
    const bitPos = 7 - (bitIndex % 8);

    fullBuffer[byteIdx] |= (bit << bitPos);
    bitIndex++;
  }

  return fullBuffer.slice(14);
}
