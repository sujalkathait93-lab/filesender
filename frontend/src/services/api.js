/**
 * SecureShare API Service Layer
 * All server communication goes through this module — pages and hooks never
 * call fetch() directly. Keeps error handling and endpoint URLs in one place.
 */

const API_URL = window.location.origin;

/** Parse a JSON response; throw a readable Error on failure. */
async function parseResponse(response) {
  if (response.status === 204) return null;
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : null;
    const err = new Error(detail || `Request failed (${response.status})`);
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Simple GET returning parsed JSON. */
async function getJson(path, headers = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json', ...headers },
  });
  return parseResponse(response);
}

/** POST returning parsed JSON. */
async function postJson(path) {
  const response = await fetch(`${API_URL}${path}`, { method: 'POST' });
  return parseResponse(response);
}

/**
 * Upload a FormData body with real upload progress via XMLHttpRequest
 * (fetch does not expose upload progress).
 */
function uploadFormData(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const doUpload = (urlPath) => {
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
        } else if ((xhr.status === 405 || xhr.status === 404) && urlPath === '/api/upload') {
          // Automatic fallback in case proxy or serverless rewrite stripped the prefix
          doUpload('/upload');
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

/** Fetch the encrypted blob with progress; returns { blob, headers }. */
async function downloadBlob(fileId, { preview = false, onProgress, proof } = {}) {
  const params = new URLSearchParams();
  if (preview) params.set('preview', 'true');
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
  fileInfo: (id, proof) => getJson(`/api/file-info/${encodeURIComponent(id)}`, proof ? { 'X-Access-Proof': proof } : {}),
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
  download: downloadBlob,
};
