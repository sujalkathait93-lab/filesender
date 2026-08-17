<div align="center">

# FileShare

### Send, Share and Done — Encrypted file transfer

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.2-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

Files are encrypted in the browser with **AES-256-GCM** before they leave the device. The server only stores ciphertext.

</div>

## Features

- Browser-only AES-256-GCM encryption (zero-knowledge)
- Encrypted cloud relay with expiry and burn-on-read
- Short transfer codes and QR links
- In-browser preview (images, PDF, video, text)
- Steganography vault (hide a payload in an image)
- WebRTC P2P (works locally; not supported on Vercel serverless)

## Deploy on Vercel

1. Push this repo to GitHub: [sujalkathait93-lab/filesender](https://github.com/sujalkathait93-lab/filesender)
2. In Vercel, **Import** that GitHub repo
3. Leave **Root Directory** as `.` (project root)
4. Add environment variable `SECRET_KEY` (any long random string)
5. Deploy

`vercel.json` builds the React app and the Flask API together.

**Live URL:** https://filesender-sujalkathait93-6384s-projects.vercel.app

On Vercel, files live in `/tmp` (temporary). Keep uploads small. WebSocket / P2P signaling does not work on serverless.

### Push updates to GitHub

```powershell
cd C:\Users\LENOVO\Desktop\python\fileshare
git add -A
git commit -m "Update FileShare"
git push origin main
```

Vercel redeploys automatically after a push to `main`.

## Run locally

You need **Python 3.12+** and **Node.js 18+**.

**Backend** (project root):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python api/index.py
```

API: `http://localhost:8000`

**Frontend** (second terminal):

```powershell
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173` (proxies `/api` to the backend)

## Project layout

```
filesender/
├── api/                 Flask API (upload, download, health)
├── frontend/            React + Vite app
├── tests/               Backend and crypto tests
├── vercel.json          Vercel build and routes
├── requirements.txt     Python packages
└── .env.example         Optional local env vars
```

## API

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/upload` | Upload encrypted blob |
| `GET` | `/api/file-info/<id>` | Metadata (`X-Access-Proof`) |
| `GET` | `/api/download/<id>` | Download encrypted blob |
| `POST` | `/api/transfers/<id>/token/refresh` | Refresh share token |
| `DELETE` | `/api/files/<id>` | Delete (`X-Owner-Token`) |
| `GET` | `/api/stats` | Transfer stats |

## Tests

```powershell
python -m unittest tests/test_backend.py -v
node tests/crypto-roundtrip.mjs
node tests/preview-and-states.test.mjs
```

## Security notes

- The decryption key stays in the URL hash (`#key=...`) and is never sent to the server.
- The client sends only a SHA-256 access proof, not the raw password.
- The server stores encrypted blobs only.

## License

MIT
