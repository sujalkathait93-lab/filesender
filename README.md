# 🛡️ SecureShare — Easy & Safe File Sharing

<div align="center">

[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?logo=react&logoColor=black&style=for-the-badge)](https://react.dev/)
[![Python Flask](https://img.shields.io/badge/Backend-Python%20Flask%203.0-3776AB?logo=python&logoColor=white&style=for-the-badge)](https://flask.palletsprojects.com/)
[![Encryption](https://img.shields.io/badge/Security-AES--256--GCM%20%2B%20PBKDF2-10B981?logo=shield&logoColor=white&style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![Steganography](https://img.shields.io/badge/Steganography-Hidden%20In%20Image-8B5CF6?logo=image&logoColor=white&style=for-the-badge)](https://en.wikipedia.org/wiki/Steganography)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <strong>Share any file privately with bank-grade encryption, hidden inside ordinary-looking artwork images!</strong>
</p>

[How It Works (Simple Story)](#-how-it-works-in-simple-words) • [Visual Flowcharts & Explanations](#-visual-diagrams--step-by-step-teacher-guide) • [Cool Features](#-cool-features) • [Tech Stack](#-technology-stack) • [How to Run](#-how-to-run-locally) • [API Specification](#-api-specification)

</div>

---

## 🎒 How It Works in Simple Words

Imagine you want to send a secret letter to your best friend:

```
📄 Your File 
     ⬇️ (1. Pack & Shrink)
🗜️ Compressed tightly into a tiny bundle
     ⬇️ (2. Lock in a Safe)
🔒 Encrypted with a super strong mathematical lock (AES-256)
     ⬇️ (3. Hide in a Picture)
🖼️ Hidden inside the tiny colored dots (pixels) of a beautiful photo
     ⬇️ (4. Share the Magic Key)
🔑 Sent as a code: SEC-4BE819D7-9F8A73C2
     ⬇️ (5. Self-Destruct)
💥 File disappears from the server forever as soon as your friend opens it!
```

---

## 🗺️ Visual Diagrams & Step-by-Step Teacher Guide

---

### 1. Overall System Architecture
> 👨‍🏫 **Teacher's Note**: Think of this as the bird's-eye view. The sender locks the secret on their own laptop, sends it across, and only the receiver can unlock it. The server in the middle is just a blind courier—it can never see inside!

```mermaid
graph TD
    subgraph SENDER ["🧑‍💻 Sender's Computer"]
        A[Pick a File] --> B[Zip/Shrink File]
        B --> C[Lock with Strong Crypto Key]
        C --> D[Paint & Hide into Photo Pixels]
        D --> E[Ready: Stegano Artwork Photo]
    end

    subgraph CLOUD ["☁️ Zero-Knowledge Server (Blind Courier)"]
        E -->|Upload| F[(Safe Storage Vault)]
    end

    subgraph RECEIVER ["👤 Receiver's Computer"]
        F -->|Download Photo| G[Extract Hidden Pixels]
        H[Paste Magic Code] --> I[Unlock & Decrypt]
        G --> I
        I --> J[Unzip File]
        J --> K[🎉 View & Save File!]
    end

    classDef senderStyle fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef receiverStyle fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;
    classDef cloudStyle fill:#1f2937,stroke:#9ca3af,stroke-width:2px,color:#fff;

    class A,B,C,D,E senderStyle;
    class G,H,I,J,K receiverStyle;
    class F cloudStyle;
```

---

### 2. How Sending a File Works (Upload & Encryption)
> 👨‍🏫 **Teacher's Note**: Follow the numbered steps below to see what happens behind the scenes when you click **"Encrypt & Get Code"**:

```mermaid
sequenceDiagram
    autonumber
    actor Sender as 🧑‍💻 Sender
    participant Browser as 🌐 Browser App
    participant Lock as 🔐 Crypto Engine
    participant Painter as 🎨 Image Steganography
    participant Server as ☁️ Safe Vault
    actor Receiver as 👤 Receiver

    Sender->>Browser: Selects a file (PDF, Image, Video, Document)
    Browser->>Lock: Generate random secret keys & salt
    Lock->>Lock: Compress file with Gzip & Lock with AES-256-GCM
    Lock-->>Browser: Scrambled secret bytes
    Browser->>Painter: Hide secret bytes inside image pixels (LSB)
    Painter-->>Browser: Ordinary-looking PNG image
    Browser->>Server: Upload the image to vault
    Server-->>Browser: Returns File ID (e.g. 4be819d7)
    Browser->>Browser: Combine into Share Code: SEC-4BE819D7-9F8A73C2
    Browser-->>Sender: Displays Share Code & QR Code
    Sender->>Receiver: Sends the code on WhatsApp / Telegram / Email
```

#### 📖 Step-by-Step Breakdown for Students:
1. **You choose your file**: You drag and drop any file into the website.
2. **Your browser creates a lock**: It generates a unique random key that nobody else in the world knows.
3. **The file gets locked**: Using military-grade **AES-256**, your file turns into scrambled unreadable noise.
4. **The secret is painted into a picture**: The scrambled data is hidden inside the color shades of an image.
5. **Uploaded to the server**: Only the photo is sent to the server. The server **never** receives your password.
6. **You get your magic code**: A neat code like `SEC-4BE819D7-9F8A73C2` is generated for you to share!

---

### 3. How Receiving a File Works (Download & Decryption)
> 👨‍🏫 **Teacher's Note**: Here is how your friend uses the code to unlock the file:

```mermaid
sequenceDiagram
    autonumber
    actor Receiver as 👤 Receiver
    participant Browser as 🌐 Receiver Browser
    participant Server as ☁️ Safe Vault
    participant Painter as 🎨 Image Reader
    participant Lock as 🔐 Crypto Unlocker

    Receiver->>Browser: Pastes Code (e.g. SEC-4BE819D7-9F8A73C2)
    Browser->>Browser: Splits code into File ID & Password
    Browser->>Server: Fetch file with File ID
    Server-->>Browser: Sends the hidden image
    Note over Server: If "Burn-on-Read" was turned on, server deletes the file right now!
    Browser->>Painter: Scan pixels and extract hidden bytes
    Painter-->>Browser: Scrambled secret bytes
    Browser->>Lock: Unlock using Password from the code
    Lock-->>Browser: Original clean file
    Browser-->>Receiver: Shows instant Preview or Download button!
```

#### 📖 Step-by-Step Breakdown for Students:
1. **Paste the code**: Your friend types or pastes the share code.
2. **Fetch the photo**: The browser downloads the camouflage image from the vault.
3. **Self-destruct (Burn-on-Read)**: If enabled, the server permanently deletes the file so it can never be downloaded again.
4. **Extract hidden data**: The browser inspects the photo's pixels and extracts the hidden scrambled data.
5. **Unlock the safe**: The browser uses the secret key inside the code to turn the scrambled data back into your original file.
6. **Enjoy the file**: Your friend can preview the PDF/photo right in their browser or save it to their computer!

---

### 4. How Steganography Hides Data in Image Pixels
> 👨‍🏫 **Teacher's Note**: How do we hide a secret inside a picture without anyone noticing? Every picture is made of millions of tiny dots called **pixels**. Each pixel has three colors: **Red (R)**, **Green (G)**, and **Blue (B)** with brightness from 0 to 255. We gently tweak the very last bit (Least Significant Bit) of each color!

```mermaid
flowchart LR
    subgraph INPUT ["1. Your Secret Data"]
        DATA["Binary bits: 1 0 1 1 0 0 ..."]
    end

    subgraph PIXEL ["2. One Tiny Pixel Dot"]
        R["Red Channel: 240 (Tweaked to 241)"]
        G["Green Channel: 110 (Tweaked to 110)"]
        B["Blue Channel: 85 (Tweaked to 84)"]
    end

    subgraph OUTPUT ["3. Resulting Picture"]
        IMG["Looks 100% identical to human eyes! 👀✨"]
    end

    INPUT --> PIXEL --> OUTPUT
```

- If Red color is `240` (binary `11110000`), we change just the last digit to `1` $\rightarrow$ `241` (binary `11110001`).
- The change in color is so tiny that **no human eye can see any difference!**
- But the computer can read every single bit back with 100% accuracy.

---

## 🌟 Cool Features

- 🔒 **Zero-Knowledge**: Everything is locked and unlocked inside your browser. The server never sees your plain files or passwords.
- 🖼️ **Image Camouflage (Steganography)**: Encrypted files look like ordinary space artwork photos.
- 💥 **Burn-on-Read**: Want maximum secrecy? Set it to auto-delete after the very first download.
- ⚡ **Direct WebRTC Mode**: Send files directly computer-to-computer (P2P) across your local WiFi or the Internet.
- 👁️ **Instant Quick View**: Preview PDFs, photos, and text files directly in the browser without even saving them to disk.
- ⏱️ **Auto Expiry**: Files automatically expire and get wiped clean after 1 hour, 4 hours, or 24 hours.

---

## 🛠️ Technology Stack

| Layer | Tool / Technology | What It Does |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | Fast, modern, responsive interactive web user interface |
| **Backend** | Python Flask 3.0 | Lightweight API to store and serve the encrypted files |
| **Database** | SQLite3 | Keeps track of file IDs, timers, and download counts |
| **Encryption** | Web Crypto API (AES-256-GCM + PBKDF2) | Bank-grade in-browser cryptographic security |
| **Steganography** | HTML5 Canvas LSB Engine | Reads and writes hidden secret bits in pixel color channels |
| **P2P Networking** | WebRTC + Socket.IO | Direct browser-to-browser high-speed data transfers |

---

## 📁 Project Structure

```
secureshare/
├── api/
│   └── index.py               # Python Flask API & WebRTC signaling
├── database/
│   └── .gitkeep               # Safe database folder
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Upload.jsx     # Send / Encrypt / Embed screen
│   │   │   └── Download.jsx   # Receive / Decrypt / Preview screen
│   │   ├── crypto.js          # Web Crypto API: AES-256-GCM & PBKDF2
│   │   ├── steganography.js   # Canvas pixel LSB encoder & extractor
│   │   ├── webrtc.js          # WebRTC P2P DataChannel connection
│   │   ├── App.jsx            # Main app router
│   │   └── App.css            # Dark mode neon styles
│   ├── index.html             # Main web entry
│   └── package.json           # Node packages
├── uploads/                   # Temporary encrypted storage
├── requirements.txt           # Python packages
└── README.md                  # Project documentation
```

---

## 💻 How to Run Locally

### Step 1: Start the Backend (Port 8000)
```powershell
pip install -r requirements.txt
python api/index.py
```

### Step 2: Start the Frontend (Port 5173)
```powershell
cd frontend
npm install
npm run dev
```

Open **`http://localhost:5173`** in your web browser!

---

## 📡 API Specification

| Method | URL | What It Does |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Checks if the server is healthy and running |
| `POST` | `/api/upload` | Uploads an encrypted stegano picture blob |
| `GET` | `/api/file-info/<id>` | Gets file details (size, expiration, etc.) without downloading the file |
| `GET` | `/api/download/<id>` | Downloads the encrypted picture file |
| `DELETE`| `/api/files/<id>` | Manually deletes a file immediately |
| `GET` | `/api/stats` | Shows server statistics |

---

## 📜 License

This project is licensed under the **MIT License**.

<div align="center">
  <sub>Built with ❤️ for privacy, security, and simple learning.</sub>
</div>
