# SecureShare 🔒🖼️

SecureShare is a private file-sharing web application. It locks files directly inside your web browser before uploading them, hides the scrambled data inside an ordinary-looking picture, and gives you a single secret code to share with your receiver.

---

## 🌟 The Big Picture: How it Works (Simply Explained)

Usually, when you upload a file to a website, their servers can read and see everything inside your file. SecureShare prevents this using three simple techniques:

### 1. Encryption 🔑 (The Safe)
* **What it is:** Scrambling your file into unreadable mathematical code (AES-256).
* **Why we use it (Purpose):** To lock the file before it leaves your computer. If a hacker intercepts it, it looks like random gibberish (`x8#q2!9%`). Only someone with the secret key can decrypt it.
* **Analogy:** Putting a secret letter inside a small, heavy iron safe before mailing it.

### 2. Steganography 🎨 (The Hollow Book)
* **What it is:** Hiding the scrambled data inside the tiny color dots (pixels) of a digital picture.
* **Why we use it (Purpose):** To hide the fact that you are sharing a file. To anyone else (like a server or internet router), you are just uploading or downloading a normal cat photo.
* **Analogy:** Hiding your locked iron safe inside a hollowed-out dictionary on a bookshelf.

### 3. WebRTC & Socket.IO 🤝 (Direct Conversation)
* **What it is:** Connecting two web browsers directly to each other.
* **Why we use it (Purpose):** To send files directly from your computer to your friend's computer without uploading them to a storage server.
* **Analogy:** Introducing two people at a party so they can talk face-to-face, instead of passing letters through a third person.

---

## 🛠️ Technologies Used & Why We Use Them

| Technology / Component | What it is / What it does | Why We Use It |
| :--- | :--- | :--- |
| **React 18 + Vite** | Powers the webpage interface | For a fast, responsive, and easy-to-use website layout. |
| **Python Flask** ([`api/index.py`](api/index.py)) | Acts as the backend "matchmaker" | Connects the two browsers together so they can initiate a direct peer-to-peer connection. |
| **Web Crypto API (AES-256)** | Scrambles and locks files inside your browser | Ensure files are locked *before* leaving your machine; the server never learns your passwords. |
| **HTML5 Canvas** | Reads and edits image pixel colors | Allows us to embed the secret data into image colors without changing how the image looks. |
| **SQLite3** | Database to store file codes & expirations | To keep track of download limits, file sizes, and automatically expire files when their time runs out. |

---

## 🔐 Cryptography Deep Dive: Web Crypto API (AES-256-GCM + PBKDF2)

To keep files private without sharing passwords with the server, SecureShare handles all encryption directly in your web browser using the native **Web Crypto API** (`window.crypto.subtle`). 

Here is how it works, explained in **three simple points**:

### 1. Key Maker (PBKDF2) 🔑
* **What it does**: Turns a simple text password (like `"my-password"`) into a strong, mathematically secure 256-bit key.
* **Why we use it**: Computers can easily guess short, simple passwords. PBKDF2 mixes the password with a random **Salt** (random bytes) and hashes it **100,000 times**. This makes guessing the password extremely slow and expensive for hackers.
* **Analogy**: Baking a fragile piece of clay (your raw password) in a hot kiln for hours to turn it into a solid, unbreakable brick.

### 2. The Secure Safe (AES-256-GCM) 🔒
* **What it does**: Scrambles your files and locks them so only your derived key can open them.
* **Why we use it**: AES-256 is an industry-standard secure lock. **GCM** adds a tamper-proof "security seal" (Authentication Tag) to the locked file. If anyone tries to modify or corrupt the encrypted file, the seal breaks, and the browser will refuse to decrypt it.
* **Analogy**: Putting your file in a heavy iron safe (encryption) and wrapping it with an official tamper-evident security seal (authentication tag).

### 3. The Randomness Mixers (Salt & IV) 🎲
* **What they do**: 
  * **Salt**: 16 random bytes added to the password.
  * **IV (Initialization Vector)**: 12 random bytes added to the encryption process.
* **Why we use them**: If you encrypt the same file with the same password twice, the output will look identical without them. Salt and IV guarantee that encrypting the same file with the same password 100 times produces 100 completely different-looking scrambled files.
* **Analogy**: A chef using different seasonings (Salt) and cooking times (IV) for every order, ensuring every single dish tastes unique, even if they started with the same basic ingredients.

---

### 📊 Step-by-Step Data Flow Example

Here is exactly how a file is processed, step-by-step:

#### 🟢 Step A: The Sender Encrypts a File
1. **Inputs**: The file (`"secret-report.pdf"`) and a password (`"hello123"`).
2. **Key Derivation**: The browser generates a random **Salt**, combines it with `"hello123"`, and runs **PBKDF2** to get a **256-bit Key**.
3. **Encryption**: The browser generates a random **IV**, combines the file, key, and IV, and runs **AES-GCM**.
4. **Output Package**: You get:
   * 📦 **Encrypted File Data** (scrambled gibberish)
   * 🏷️ **Authentication Tag** (tamper seal)
   * 🎲 **Salt & IV** (required for decryption)

#### 🔴 Step B: The Receiver Decrypts the File
1. **Inputs**: The output package (Encrypted File, Tag, Salt, IV) and the password (`"hello123"`).
2. **Key Derivation**: The browser uses the password + the saved **Salt** to recreate the exact same **256-bit Key**.
3. **Decryption & Verification**: The browser inputs the Encrypted File, Tag, IV, and Key into **AES-GCM**.
4. **Outcome**: The browser verifies the tamper seal (Tag) is intact and decrypts the scrambled data back into the original `"secret-report.pdf"`.

---

### 💻 Web Crypto API Code Example

Here is a complete, copy-pasteable JavaScript implementation showing how to encrypt and decrypt text directly in the browser console using the Web Crypto API:

```javascript
// Helper to convert strings to ArrayBuffers and vice-versa
const encode = (txt) => new TextEncoder().encode(txt);
const decode = (buf) => new TextDecoder().decode(buf);

// 1. Deriving a Key from a Password (PBKDF2)
async function deriveKey(password, salt) {
  // Import the raw password text as a temporary key-material
  const tempKey = await window.crypto.subtle.importKey(
    "raw",
    encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Derive the actual AES-GCM 256-bit key from the password + salt
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    tempKey,
    { name: "AES-GCM", length: 256 },
    false, // key is not exportable for security
    ["encrypt", "decrypt"]
  );
}

// 2. Encryption (AES-GCM)
async function encryptData(plaintext, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16)); // 16-byte random salt
  const iv = window.crypto.getRandomValues(new Uint8Array(12));   // 12-byte random IV for GCM
  
  const key = await deriveKey(password, salt);
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encode(plaintext)
  );

  // Return ciphertext alongside salt and iv (needed for decryption)
  return {
    ciphertext: new Uint8Array(ciphertext),
    salt: salt,
    iv: iv
  };
}

// 3. Decryption (AES-GCM)
async function decryptData(ciphertext, password, salt, iv) {
  const key = await deriveKey(password, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  return decode(decrypted);
}

// --- Usage Example ---
(async () => {
  const password = "my-super-secret-password";
  const message = "Hello SecureShare! This is a secret message.";
  
  console.log("Original Message:", message);
  
  // Encrypt
  const encrypted = await encryptData(message, password);
  console.log("Ciphertext (scrambled):", encrypted.ciphertext);
  
  // Decrypt
  const decrypted = await decryptData(encrypted.ciphertext, password, encrypted.salt, encrypted.iv);
  console.log("Decrypted Message:", decrypted);
})();
```

---

## 🚀 How to Run It on Your Computer

### Prerequisites
Make sure you have **Node.js** (version 18 or higher) and **Python** (version 3.10 or higher) installed.

#### Step 1: Start the Backend (The Matchmaker)
Open a terminal in the project's root folder and run:
```powershell
pip install -r requirements.txt
python api/index.py
```
*This starts the Flask server at `http://localhost:8000`.*

#### Step 2: Start the Frontend (The Interface)
Open a second terminal window, navigate to the `frontend` folder, and run:
```powershell
cd frontend
npm install
npm run dev
```
*Open **`http://localhost:5173`** in your browser to start sharing files privately!*

---

## 💡 Key Features

* **Zero-Knowledge:** The server never holds your passwords or decrypted files.
* **Self-Destruct (Burn-on-Read):** Files are automatically deleted from the server the instant they are downloaded once.
* **Auto-Expire:** Files automatically delete after a set time (e.g. 1 hour, 4 hours, or 24 hours).
* **Direct Transfer:** Fast browser-to-browser transfer for larger files over WebRTC.
