/**
 * API client for the Flask backend.
 * Uses native fetch and XMLHttpRequest for upload progress tracking.
 * Includes intelligent chunked upload streaming to bypass serverless & proxy size limits.
 */

const API_URL = import.meta.env.VITE_API_URL || '';
const CHUNK_UPLOAD_SIZE = 2.5 * 1024 * 1024; // 2.5 MB safe slices (well within Vercel's 4.5 MB limit)

async function parseResponse(response) {
  if (!response.ok) {
    let detail = null;
    try {
      const json = await response.json();
      detail = json.detail;
    } catch (_) {}
    const err = new Error(detail || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function getJson(path, headers = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json', ...headers },
  });
  return parseResponse(response);
}

async function postJson(path, data = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
  return parseResponse(response);
}

/**
 * Upload a FormData body with real upload progress via XMLHttpRequest.
 */
function uploadFormData(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const doUpload = (urlPath, isRetry = false) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}${urlPath}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
        }
      };

      xhr.onload = () => {
        let body = null;
        try { body = JSON.parse(xhr.responseText || 'null'); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else if (!isRetry && (xhr.status === 405 || xhr.status === 404)) {
          // Automatic fallback if proxy or serverless rewrite changed prefix
          const altPath = urlPath.startsWith('/api') ? urlPath.replace(/^\/api/, '') : `/api${urlPath}`;
          doUpload(altPath, true);
        } else {
          const err = new Error((body && body.detail) || `Upload failed (${xhr.status})`);
          err.status = xhr.status;
          err.body = body;
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload aborted'));
      xhr.send(formData);
    };

    doUpload(path);
  });
}

/**
 * Upload an encrypted file blob.
 * - Files <= 4 MB: Fast direct single-shot upload.
 * - Files > 4 MB (up to 1 GB): Streams via 2.5 MB chunks to safely bypass
 *   serverless function body limits (e.g. Vercel 4.5 MB) and proxy constraints.
 */
async function uploadFileSmart(fileBlob, metadata, onProgress) {
  if (fileBlob.size <= 4 * 1024 * 1024) {
    const formData = new FormData();
    formData.append('file', fileBlob, metadata.filename || 'file.encrypted');
    for (const [k, v] of Object.entries(metadata)) {
      if (v !== undefined && v !== null && k !== 'filename') {
        formData.append(k, String(v));
      }
    }
    return uploadFormData('/api/upload', formData, onProgress);
  }

  // Multi-chunk upload pipeline for large files
  const totalSize = fileBlob.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_UPLOAD_SIZE);

  // 1. Initialize session
  const initRes = await postJson('/api/upload/init', {
    ...metadata,
    total_chunks: totalChunks,
    original_size: metadata.original_size || totalSize
  });

  const { file_id, transfer_id, owner_token } = initRes;
  let uploadedBytes = 0;

  // 2. Upload chunks sequentially
  for (let idx = 0; idx < totalChunks; idx++) {
    const start = idx * CHUNK_UPLOAD_SIZE;
    const end = Math.min(totalSize, start + CHUNK_UPLOAD_SIZE);
    const chunkBlob = fileBlob.slice(start, end);

    const chunkForm = new FormData();
    chunkForm.append('chunk', chunkBlob, `chunk_${idx}.bin`);
    chunkForm.append('transfer_id', transfer_id);
    chunkForm.append('file_id', file_id);
    chunkForm.append('chunk_index', String(idx));
    chunkForm.append('total_chunks', String(totalChunks));

    let chunkUploaded = 0;
    await uploadFormData('/api/upload/chunk', chunkForm, (p) => {
      chunkUploaded = p.loaded;
      if (onProgress) {
        const currentTotalLoaded = uploadedBytes + chunkUploaded;
        onProgress({
          loaded: currentTotalLoaded,
          total: totalSize,
          percent: Math.min(99, Math.round((currentTotalLoaded / totalSize) * 100))
        });
      }
    });

    uploadedBytes += (end - start);
  }

  // 3. Complete and assemble
  const completeRes = await postJson('/api/upload/complete', {
    transfer_id,
    file_id,
    total_chunks: totalChunks,
    owner_token
  });

  if (onProgress) {
    onProgress({ loaded: totalSize, total: totalSize, percent: 100 });
  }

  return completeRes;
}

/** Fetch the encrypted blob with progress; returns { blob, headers }. */
async function downloadBlob(fileId, { preview = false, onProgress, proof } = {}) {
  const params = new URLSearchParams();
  if (preview) params.set('preview', '1');
  const qs = params.toString();
  const headers = { Accept: 'application/octet-stream' };
  if (proof) headers['X-Access-Proof'] = proof;
  const response = await fetch(
    `${API_URL}/api/download/${fileId}${qs ? `?${qs}` : ''}`,
    { headers }
  );

  if (!response.ok) {
    let detail = null;
    try {
      const json = await response.json();
      detail = json.detail;
    } catch (_) {}
    const err = new Error(detail || `Download failed (${response.status})`);
    err.status = response.status;
    throw err;
  }

  const contentLength = Number(response.headers.get('Content-Length') || 0);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (onProgress && contentLength > 0) {
      onProgress(received, contentLength);
    }
  }

  return {
    blob: new Blob(chunks),
    headers: {
      isBurn: response.headers.get('X-Burn-On-Read') === '1',
      compressed: response.headers.get('X-Compressed'),
      checksum: response.headers.get('X-Checksum') || '',
      iv: response.headers.get('X-IV'),
      salt: response.headers.get('X-Salt'),
    },
  };
}

export const api = {
  health: () => getJson('/api/health'),
  networkInfo: () => getJson('/api/network-info'),
  stats: () => getJson('/api/stats'),
  fileInfo: (id, proof) => getJson(`/api/files/${encodeURIComponent(id)}`, proof ? { 'X-Access-Proof': proof } : {}),
  refreshToken: (transferId) => postJson(`/api/transfers/${encodeURIComponent(transferId)}/token/refresh`),
  deleteFile: (id, ownerToken) => fetch(`${API_URL}/api/files/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Owner-Token': ownerToken || '', Accept: 'application/json' },
  }).then(async (response) => {
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const err = new Error((body && body.detail) || `Delete failed (${response.status})`);
      err.status = response.status;
      throw err;
    }
    return response.json().catch(() => ({ message: 'File deleted' }));
  }),
  upload: (formData, onProgress) => uploadFormData('/api/upload', formData, onProgress),
  uploadSmart: uploadFileSmart,
  download: downloadBlob,
};
