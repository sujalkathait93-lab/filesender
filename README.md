<div align="center">

# FileShare

### High-Performance, Zero-Knowledge Encrypted File Transfer with Stream and Batch Processing

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.2-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Web Crypto](https://img.shields.io/badge/Web_Crypto_API-AES--256--GCM-4CAF50?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**Live Application:** [filesender-coral.vercel.app](https://filesender-coral.vercel.app/)  
**GitHub Repository:** [sujalkathait93-lab/filesender](https://github.com/sujalkathait93-lab/filesender)

---

</div>

## Overview

FileShare is a high-performance, privacy-first web application designed for secure, zero-knowledge file sharing. It implements a stream and batch processing architecture that enables users to transfer large files without buffering them completely in system memory.

Files are encrypted directly in the browser using hardware-accelerated **AES-256-GCM** before any byte is transmitted. The backend server acts strictly as a lightweight signaling gateway and metadata coordinator, storing only ephemeral session records in SQLite and never storing or inspecting plaintext files.

---

## Core Architecture and Features

### 1. Stream and Batch Processing Pipeline
- **Memory-Safe File Slicing:** Slices large files from disk using `File.slice()` in discrete 256 KB chunks (262,144 bytes), preventing browser and server RAM exhaustion.
- **Batch Grouping:** Automatically groups 8 consecutive chunks into 2 MB batches prior to encryption and network dispatch.
- **Per-Batch AES-256-GCM Encryption:** Encrypts each 2 MB batch independently using counter-derived initialization vectors (IVs), ensuring both confidentiality and cryptographic integrity.
- **Direct-to-Disk Streaming:** Receivers stream and write decrypted batches directly to disk using the browser-native File System Access API (`showSaveFilePicker` and `createWritable`), eliminating memory overhead on the receiving client.

### 2. Zero-Knowledge Cryptography
- **Client-Side Key Generation:** Generates high-entropy 256-bit keys and random 16-byte salts in the browser using the Web Crypto API.
- **Key Derivation (PBKDF2):** Derives encryption keys using PBKDF2 with SHA-256 and 100,000 iterations.
- **URL Fragment Isolation:** Appends the decryption key exclusively to the URL fragment (`#key=...`). The key is never transmitted over HTTP headers or stored on the server.
- **Access Proof Protocol:** Verifies download authorization using a SHA-256 hash digest (`fileshare-access:<password>`), authenticating requests without revealing the decryption key.

### 3. Reliability, Retries, and Integrity
- **Real-Time Flow Control:** WebRTC DataChannels utilize buffered amount backpressure monitoring (`bufferedAmountLowThreshold`) to prevent packet congestion.
- **Automatic Retry Mechanism:** Implements a NACK protocol over the DataChannel, enabling the receiver to detect missing chunks/batches and request immediate retransmission.
- **Pause, Resume, and Cancellation:** Both sender and receiver can pause, resume, or abort active transfers on demand with graceful resource cleanup.
- **End-to-End SHA-256 Verification:** Calculates pre-encryption and post-decryption SHA-256 hashes to guarantee byte-for-byte file integrity.

### 4. Privacy and Storage Rules
- **Metadata-Only SQLite Storage:** The SQLite database stores only transfer identifiers, chunk counts, byte sizes, checksums, and expiry timestamps. Plaintext files never touch server storage.
- **Burn-on-Read:** Transfers configured with Burn-on-Read are automatically and permanently purged from server memory and disk immediately after the first successful download.
- **Steganography Vault:** Supports embedding encrypted payloads into the Least Significant Bits (LSB) of PNG pixel arrays, providing plausible deniability.

---

## System Architecture

```mermaid
graph TD
    subgraph SENDER ["Sender Browser"]
        S1[Disk File] -->|File.slice| S2[256 KB Chunks]
        S2 -->|Group 8 Chunks| S3[2 MB Batches]
        S3 -->|AES-256-GCM| S4[Encrypted Batches]
        S4 -->|DataChannel Flow Control| S5[WebRTC DataChannel]
    end

    subgraph BACKEND ["Backend Signaling & Metadata"]
        B1[Flask REST API] --> B2[SQLite WAL Database]
        B3[Socket.IO Signaling Server] -.->|SDP / ICE Exchange| S5
        B2 ---|Stores Only Transfer Metadata| B4[(Metadata Only)]
    end

    subgraph RECEIVER ["Receiver Browser"]
        S5 -->|Stream Ingest| R1[Batch Collector]
        R1 -->|NACK / Retry Check| R2[Checksum Validator]
        R2 -->|AES-256-GCM Decrypt| R3[Decrypted Batch]
        R3 -->|File System Access API| R4[Direct Disk Stream]
        R4 -->|Final Check| R5[SHA-256 Verification]
    end
```

---

## Data Flow Sequences

### Stream and Batch Transfer Flow

```mermaid
sequenceDiagram
    autonumber
    actor Sender as Sender Browser
    participant Signaling as Backend Signaling Gateway
    actor Receiver as Receiver Browser

    Note over Sender,Receiver: WebRTC P2P Handshake (SDP Offer/Answer + ICE via Socket.IO)
    Sender->>Signaling: SDP Offer + ICE Candidates
    Signaling->>Receiver: Relay SDP Offer
    Receiver->>Signaling: SDP Answer + ICE Candidates
    Signaling->>Sender: Relay SDP Answer

    Note over Sender,Receiver: Direct WebRTC DataChannel Established

    loop For each 2 MB Batch (8 x 256 KB Chunks)
        Sender->>Sender: Read 256 KB chunks from disk
        Sender->>Sender: Encrypt 2 MB batch with AES-256-GCM
        Sender->>Receiver: Send encrypted batch packet
        Receiver->>Receiver: Validate batch checksum
        alt Checksum Valid
            Receiver->>Receiver: Decrypt batch & write directly to disk
        else Checksum Mismatch / Dropped Batch
            Receiver->>Sender: Request batch retransmission (RETRY_BATCH)
            Sender->>Receiver: Retransmit batch
        end
    end

    Sender->>Receiver: Send TRANSFER_COMPLETE
    Receiver->>Receiver: Verify final SHA-256 checksum against manifest
```

---

## Tech Stack Breakdown

### Frontend Components

| Component | Technical Role |
| :--- | :--- |
| **React 18** | Manages UI state, transfer progress displays, modal dialogs, and component lifecycle. |
| **Vite 5** | Provides Hot Module Replacement (HMR) and compiles optimized production assets. |
| **Web Crypto API** | Executes hardware-accelerated AES-256-GCM encryption and PBKDF2 key derivation. |
| **Streams & File System API** | Facilitates progressive chunk reading and direct-to-disk write streaming without full RAM buffering. |
| **Socket.IO Client** | Manages real-time WebRTC signaling and peer discovery. |
| **Lucide Icons** | Vector iconography for interface actions and transfer state feedback. |

### Backend Components

| Component | Technical Role |
| :--- | :--- |
| **Python 3.12** | Core backend language providing high efficiency and modern type annotations. |
| **Flask 3.0** | Lightweight WSGI server managing REST endpoints and fallback cloud relay routes. |
| **Flask-SocketIO** | Handles bidirectional WebSocket signaling for WebRTC peer connection setup. |
| **SQLite (WAL Mode)** | High-concurrency metadata repository storing session state, chunk counts, and expiry times. |
| **Sliding Window Rate Limiter** | Enforces endpoint rate limits to protect signaling and relay routes from abuse. |
| **Cleanup Service** | Background worker thread that sweeps and purges expired transfer records. |

---

## REST API Reference

| Method | Endpoint | Required Headers / Params | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Reports server health and storage status. |
| `GET` | `/api/network-info` | None | Retrieves STUN/TURN configuration for WebRTC NAT traversal. |
| `POST` | `/api/upload` | Multipart Form | Uploads encrypted relay fallback blob and metadata. |
| `GET` | `/api/file-info/<id>` | `X-Access-Proof` | Retrieves transfer metadata without downloading the encrypted payload. |
| `GET` | `/api/download/<id>` | `X-Access-Proof`, `?preview=bool` | Streams encrypted binary blob (supports Burn-on-Read). |
| `POST` | `/api/transfers/<id>/token/refresh` | None | Refreshes share tokens and enforces session limits. |
| `DELETE` | `/api/files/<id>` | `X-Owner-Token` | Permanently deletes a transfer and its associated records. |

---

## Local Development and Setup

### Prerequisites
- Python 3.12 or higher
- Node.js 18 or higher and npm

### 1. Backend Service

```bash
# Set up virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Start Flask API server (Port 8000)
python api/index.py
```

### 2. Frontend Application

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server (Port 5173)
npm run dev
```

The web application will be accessible at `http://localhost:5173`.

---

## Verification and Testing

Execute the automated test suite to validate backend APIs, cryptographic functions, and state machines:

```bash
# Run backend integration test suite (56 tests)
python tests/test_backend.py

# Run browser cryptographic roundtrip validation
node tests/crypto-roundtrip.mjs

# Run preview and state machine tests
node tests/preview-and-states.test.mjs
```

---

## Deployment

1. Push your repository to GitHub:
   ```bash
   git add -A
   git commit -m "Deploy FileShare"
   git push origin main
   ```
2. Import the repository in [Vercel](https://vercel.com).
3. Set **Root Directory** to `.` (project root).
4. Configure environment variable:
   - `SECRET_KEY`: A secure 64-character random string.
5. Deploy. The React frontend and Flask API are built and deployed together using `vercel.json`.

---

## License

This project is licensed under the [MIT License](LICENSE).
