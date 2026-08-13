# SecureShare

**SecureShare** is a simple, end-to-end encrypted file sharing web app. Files are encrypted and compressed **in your browser** with AES-256-GCM before they ever reach the server, so even the server cannot read them.

## What it does

- **Send a file** — pick a file, get a secure share code, share it with anyone.
- **Receive a file** — paste the code, decrypt in the browser, download (or quick-view PDFs, images, text).
- **Hide inside an image** — encrypted data is embedded into the pixels of a PNG, so transfers look like ordinary photos (steganography).
- **Burn-on-Read** — optionally delete the file from the server immediately after the first download.

The flow is always the same and there is only one way to send: pick a file, click one button, share the code.

## Tech stack

| Layer | Technology |
|:---|:---|
| Frontend | React 18 + Vite + React Router |
| Backend | Python Flask |
| Database | SQLite |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2-SHA256, 100k iterations) + gzip |
| Steganography | LSB embedding into canvas-rendered PNG pixels |

## Getting started

### 1. Start the backend (port 8000)

```bash
pip install -r requirements.txt
python api/index.py
```

### 2. Start the frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies `/api` requests to the backend, so no extra configuration is needed.

## How to use it

**As the sender:**
1. Open the **Send a File** page.
2. Drag & drop (or click to select) any file.
3. Optionally enable *Burn-on-Read* (file deletes after the first download) and pick how long the code stays valid.
4. Click **Encrypt & Get Code** — done. Your file is encrypted, hidden inside an image, and stored.
5. Copy the **share code** (e.g. `SEC-4BE819D7-9F8A73C2`) and send it to the recipient by any message app.

**As the receiver:**
1. Open the **Receive a File** page.
2. Paste the share code.
3. Click **Receive File**, then choose **Quick View** (preview without downloading) or **Save & Download**.

The decryption key travels inside the share code itself, so the recipient does not need to type anything extra.

## API

| Method | Route | Description |
|:---|:---|:---|
| `GET` | `/api/health` | Server health check |
| `POST` | `/api/upload` | Upload an encrypted file blob (multipart: `file`, `iv`, `salt`, `original_name`, `original_size`, `burn_on_read`, `expiry_hours`) |
| `GET` | `/api/file-info/{file_id}` | File metadata (name, size, expiry, IV, salt) — no payload |
| `GET` | `/api/download/{file_id}?preview=true\|false` | Stream the encrypted blob; `preview=true` never burns, otherwise Burn-on-Read deletes the file after download |
| `DELETE` | `/api/files/{file_id}` | Delete a file immediately |
| `GET` | `/api/stats` | Server statistics |

## Production notes

- The frontend is a static build (`npm run build` → `frontend/dist`), deployable anywhere static files are served.
- The backend needs a persistent writable disk for `database/app.db` and `uploads/`. On ephemeral/read-only hosting (e.g. some serverless platforms) file storage will not survive restarts; set `DB_PATH` and `UPLOAD_DIR` to a persistent volume.
- Files are automatically purged after their expiry time and after Burn-on-Read downloads.
