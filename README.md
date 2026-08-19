<div align="center">

# 🔒 FileShare

### High-Performance, Zero-Knowledge Encrypted File Transfer with Stream & Batch Processing

[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.2-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Web Crypto](https://img.shields.io/badge/Web_Crypto_API-AES--256--GCM-4CAF50?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Direct-FF5722?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**Live Application:** https://filesender-coral.vercel.app/  
**GitHub Repository:** https://github.com/sujalkathait93-lab/filesender

---

</div>

## 📌 Overview

**FileShare** is a high-performance, privacy-first web application designed for secure, zero-knowledge file sharing. Built with a stream-and-batch processing pipeline, it allows users to transfer files up to 1 GB safely without loading entire files into memory.

Files are encrypted directly in the user's browser using hardware-accelerated **AES-256-GCM** before transmission. The backend server functions strictly as an ephemeral metadata coordinator and optional fallback relay—**decryption keys and plaintext files never touch the server disk or memory**.

---

## ✨ Key Capabilities & Features

### 1. ⏱️ Ephemeral Expiry Countdown (15s up to 3 Minutes)
- **Strict Ephemeral Window:** Configurable live countdown options (**15s, 30s, 45s, 60s, 2 min, up to 3 min / 180s**).
- **Sub-Second Auto-Purge:** The moment the countdown timer expires, backend background cleanup sweeps immediately unlink the ciphertext file and purge SQLite metadata.
- **Visual Countdown:** Live countdown timers with warning pulses and automatic recipient notice.

### 2. 🔢 10-Digit Transfer Codes (`FS-XXXXX-XXXXX`)
- **Seamless Code Format:** 5-character file ID + 5-character decryption key combined into a standard 10-digit/char code (e.g., `FS-4BE81-9F8A7`).
- **Flexible Code Parsing:** Seamlessly accepts `FS-XXXXX-XXXXX`, `XXXXX-XXXXX`, raw 10-hex strings (`4BE819F8A7`), numeric strings, or direct URL hash links (`#key=...`).

### 3. 📊 Sender Dashboard (Exactly 7 Organized Boxes)
The sender screen features an organized 7-box telemetry layout:
1. **File Preview Box:** Instant image thumbnail / file category icon, total size, file count, and modal inspection.
2. **Transfer Code Box:** Prominent 10-digit code with one-click copy and instant confirmation.
3. **QR Code Box:** Scannable SVG QR code with dynamic token rotation (`0/5`), WhatsApp share, and share message generator.
4. **Expiry Time Box:** Real-time countdown timer in seconds with animated progress track.
5. **Download Count Box:** Downloads used vs maximum allowed (`0 / 10 used`), remaining quota, and Burn-on-Read badge.
6. **Active Users Box:** Live WebRTC signaling status (`0 Active Downloaders` / `1 Connected Peer`).
7. **Transfer Status Box:** Zero-Knowledge AES-256 verification seal and device-only key assurance.

### 4. 🗂️ Sender Transfer History & Instant Cancellation
- **Active Share Monitoring:** Track multiple active transfers simultaneously with live countdowns and remaining download quotas.
- **Instant Revocation:** Senders can cancel and purge files immediately via `DELETE /api/cancel/<id>` with secret `X-Owner-Token` authentication.

### 5. 📥 Receiver Experience & In-Browser Preview
- **Pre-Download Inspection:** Inspect photos, audio, video, PDFs, code, and text directly in-browser before saving to disk.
- **Verification Telemetry:** Displays transfer size, download policy, countdown timer, and cryptographic security badges.
- **Burn-on-Read Self-Destruction:** Files marked with Burn-on-Read automatically self-destruct after 1 complete download.

### 6. 🌐 Multiple Transfer Modes
- **Cloud Encrypted Relay:** AES-256-GCM ciphertext stored temporarily until download limit or expiry timer is reached.
- **WebRTC Direct P2P:** Direct browser-to-browser streaming via DataChannels with **zero intermediary server storage**.
- **Steganography Image Vault:** Inconspicuously conceals encrypted bytes inside standard PNG pixel arrays.

### 7. 🧹 Zero Tracking & One-Click Privacy Purge
- **No Tracking Cookies:** Zero persistent tracking cookies or user accounts required.
- **Session Data Purge:** Dedicated Settings & Privacy tool to wipe all session tokens, cookie records, blob memory URLs, and transfer histories in one click.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph SENDER ["Sender Client (Browser)"]
        S1[Disk File] -->|File.slice| S2[256 KB Chunks]
        S2 -->|Group 8 Chunks| S3[2 MB Batches]
        S3 -->|AES-256-GCM + PBKDF2| S4[Encrypted Payload]
        S4 -->|Direct P2P DataChannel| W1[WebRTC Channel]
        S4 -->|Fallback Stream Upload| B1[Flask Backend]
    end

    subgraph BACKEND ["Backend (Signaling & Ephemeral Coordinator)"]
        B1 --> B2[SQLite WAL Database]
        B1 --> B3[Ephemeral Storage /uploads]
        B4[Background Cleanup Worker] -->|Sweeps Expiry <= 180s| B2
        B4 -->|Unlinks Expired Files| B3
    end

    subgraph RECEIVER ["Receiver Client (Browser)"]
        W1 --> R1[Decryption Engine]
        B1 -->|Stream Download| R1
        R1 -->|AES-256-GCM Decrypt| R2[File Stream]
        R2 -->|File System Access API| R3[Direct-to-Disk Save]
        R2 -->|In-Memory Buffer| R4[In-Browser File Preview]
    end
```

---

## 🔄 Transfer Flow Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Sender as Sender Browser
    participant Backend as Flask API & SQLite WAL
    actor Receiver as Receiver Browser

    Note over Sender: Encrypts file locally (AES-256-GCM, 10-Digit Code FS-XXXXX-XXXXX)
    Sender->>Backend: POST /api/upload (Encrypted ciphertext, max_downloads, expiry_seconds <= 180)
    Backend-->>Sender: 200 OK (file_id, owner_token, expires_at)

    Note over Sender,Receiver: Sender shares 10-digit code or QR code
    Receiver->>Backend: GET /api/file-info/<id> (X-Access-Proof)
    Backend-->>Receiver: Metadata (size, max_downloads, expires_at)

    alt In-Browser Preview Mode
        Receiver->>Backend: GET /api/download/<id>?preview=1
        Backend-->>Receiver: Stream Encrypted Bytes (Download count NOT decremented)
        Note over Receiver: Decrypts & renders in-browser preview modal
    else Full Download Mode
        Receiver->>Backend: GET /api/download/<id>
        Backend-->>Receiver: Stream Encrypted Bytes (Download count decremented)
        Note over Receiver: Decrypts & streams directly to disk via File System API
        opt Burn-on-Read Active or Limit Reached
            Backend->>Backend: Unlinks ciphertext blob & marks transfer burned
        end
    end
```

---

## 🛠️ Tech Stack Breakdown

### Frontend
| Technology | Role |
| :--- | :--- |
| **React 18** | Modular UI components, state machines, and reactive telemetry cards. |
| **Vite 5** | High-speed build tooling and optimized bundle compilation. |
| **Web Crypto API** | Hardware-accelerated client-side AES-256-GCM encryption & PBKDF2 key derivation. |
| **WebRTC & Socket.IO** | Peer-to-peer data channels for direct device-to-device transfers. |
| **File System Access API** | Direct-to-disk streaming writes for high memory efficiency. |
| **QRCode.react** | SVG-rendered dynamic QR codes with token refresh capabilities. |
| **Lucide React** | Clean vector iconography. |

### Backend
| Technology | Role |
| :--- | :--- |
| **Python 3.12+ / Flask 3.0** | Ephemeral REST API coordinator and chunk streaming router. |
| **SQLite (WAL Mode)** | High-concurrency relational metadata storage with indexed expiry sweeps. |
| **Threaded Cleaner** | Background worker enforcing sub-second cleanup of transfers expired within 15s–180s. |
| **Pytest** | Comprehensive integration testing covering security, TTL, and rate limits. |

---

## 🔌 REST API Reference

| Method | Endpoint | Required Headers / Params | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Reports server health, storage engine, and cleanup daemon status. |
| `GET` | `/api/network-info` | None | Retrieves STUN configuration for WebRTC NAT traversal. |
| `POST` | `/api/upload` | Multipart Form (`file`, `expiry_seconds`, `max_downloads`, etc.) | Uploads encrypted payload with metadata. |
| `POST` | `/api/upload-chunk` | Multipart Form (`file_id`, `chunk_index`, `chunk_data`) | Uploads individual chunk slice for multi-part transfers. |
| `POST` | `/api/finalize-chunked` | JSON (`file_id`, `total_chunks`, `checksum`) | Finalizes and stitches chunked transfer. |
| `GET` | `/api/file-info/<id>` | `X-Access-Proof` | Retrieves file metadata and download policy without downloading payload. |
| `GET` | `/api/download/<id>` | `X-Access-Proof`, optional `?preview=1` | Streams encrypted binary blob. |
| `POST` | `/api/transfers/<id>/token/refresh` | `X-Owner-Token` | Rotates QR access token (up to 5 refreshes). |
| `DELETE` | `/api/cancel/<id>` | `X-Owner-Token` | Senders permanently delete files and purge metadata on demand. |

---

## 💻 Local Development Setup

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** and **npm**

### 1. Backend Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start backend API (Port 8000)
python api/index.py
```

### 2. Frontend Setup
```bash
# Navigate to frontend folder
cd frontend

# Install packages
npm install

# Start Vite development server (Port 5173)
npm run dev
```

Visit application in browser at: `http://localhost:5173`

---

## 🧪 Verification and Testing

Execute the automated test suites to validate encryption, API endpoints, state machines, and countdown TTL sweeps:

```bash
# Run 59 Backend Integration Tests (Pytest)
pytest -s

# Run Frontend Cryptographic & State Machine Tests (58 tests)
node tests/preview-and-states.test.mjs

# Build production bundle
cd frontend && npm run build
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
