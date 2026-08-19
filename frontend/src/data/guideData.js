import {
  Upload, Download, ShieldCheck, Lock, Radio, Image as ImageIcon,
  Flame, Key, Zap, CheckCircle2, Eye, FileText, Sparkles,
  Layers, Check, HelpCircle, Archive, Video, Music, FileCode,
  HardDrive, Clock, Smartphone, Globe, Shield, RefreshCw
} from 'lucide-react';

/**
 * 9-Step Complete File Sharing Process
 */
export const FILE_SHARING_LIFECYCLE_STEPS = [
  {
    step: 1,
    title: 'Select File',
    desc: 'Choose one or multiple files from your computer or phone.',
    detail: 'Supports documents, photos, 4K videos, archives, or entire file folders up to 1 GB.'
  },
  {
    step: 2,
    title: 'Review Files',
    desc: 'Inspect file names, individual sizes, and total transfer size.',
    detail: 'Remove unwanted files or preview images/documents before sending.'
  },
  {
    step: 3,
    title: 'Choose Settings',
    desc: 'Select download limits (1 to 100 or Unlimited) and code expiry (15s up to 3 min).',
    detail: 'Optionally enable Burn After Read, Steganography Vault, or Direct P2P.'
  },
  {
    step: 4,
    title: 'Create Share',
    desc: 'Your browser encrypts files locally with AES-256-GCM and creates the session.',
    detail: 'Your secret decryption key stays in your browser and is never sent to the server.'
  },
  {
    step: 5,
    title: 'Show QR & Code',
    desc: 'Get your unique Transfer Code (e.g. FS-XXXX-XXXX) and dynamic QR code.',
    detail: 'Share the code or let the recipient scan the QR code with their camera.'
  },
  {
    step: 6,
    title: 'Receiver Connects',
    desc: 'The recipient enters the code or scans the QR code on any device.',
    detail: 'No account, login, or software installation required for the receiver.'
  },
  {
    step: 7,
    title: 'Download',
    desc: 'The recipient clicks Save & Download or chooses Preview Files.',
    detail: 'Data streams safely through encrypted channels.'
  },
  {
    step: 8,
    title: 'Progress',
    desc: 'Real-time progress bar displays live download speed and percentage.',
    detail: 'Fast in-memory chunk streaming prevents browser freezing.'
  },
  {
    step: 9,
    title: 'Complete',
    desc: 'Files are decrypted in the browser and saved directly to the device.',
    detail: 'If Burn After Read is active, the file is permanently wiped from the server.'
  }
];

/**
 * Point-Wise Feature Explanations (7-Question Standard)
 */
export const FEATURE_EXPLANATIONS = [
  {
    id: 'file_sharing',
    icon: Upload,
    title: 'File Sharing (Cloud Encrypted)',
    badge: 'Standard Transfer',
    badgeColor: 'badge-primary',
    whatIsIt: 'A secure way to send files to anyone using an instant Transfer Code or QR code.',
    whyUseIt: 'Send files up to 1 GB without creating an account or uploading unencrypted files.',
    howToUse: [
      'Click Select File or drop your files on the Upload page.',
      'Review your files and choose your expiry and download limit settings.',
      'Click Send File to encrypt and receive your Transfer Code & QR code.',
      'Share the code or QR with the recipient to let them download.'
    ],
    whatHappensNext: 'Files are encrypted in your browser with AES-256-GCM. The recipient enters the code and decrypts the file on their device.',
    important: 'Transfers expire automatically after 15 to 60 minutes. Maximum total transfer size is 1 GB.',
    whereStored: 'Structured metadata in database; encrypted ciphertext blob on temporary server storage; zero plaintext or keys on server.',
    whenDeleted: 'Automatically wiped forever when the expiry timer ends or the download limit is reached.',
    example: 'Sending a confidential contract PDF to a client who needs to download it within 30 minutes.'
  },
  {
    id: 'burn_after_read',
    icon: Flame,
    title: 'Burn After Read (Download Limits)',
    badge: 'Self-Destruct',
    badgeColor: 'badge-amber',
    whatIsIt: 'File becomes permanently unavailable and deleted after your selected number of successful downloads.',
    whyUseIt: 'Prevents continued access after the intended recipients have downloaded the file.',
    howToUse: [
      'Toggle Burn After Read ON or select a download limit (1, 5, 10, 30, 60, or 100).',
      'Send your transfer code or QR code to the recipient.',
      'Once the download limit is reached, the server permanently purges the file.'
    ],
    whatHappensNext: 'The file blob and records are wiped. Any subsequent attempt to access the link or code shows "File Expired — The download limit has been reached."',
    important: 'Only successful, completed downloads reduce the count. Incomplete, cancelled, or preview downloads do NOT consume a download.',
    whereStored: 'Temporary encrypted ciphertext on server during active downloads.',
    whenDeleted: 'Instantly purged the moment the final successful download completes.',
    example: 'Sharing an API key or sensitive document with one person, ensuring no one else can ever access the link again.'
  },
  {
    id: 'p2p_transfer',
    icon: Radio,
    title: 'WebRTC Direct P2P Transfer',
    badge: 'Device-to-Device',
    badgeColor: 'badge-slate',
    whatIsIt: 'Direct browser-to-browser file streaming between two active devices with zero server file storage.',
    whyUseIt: 'Transfer massive files (large 4K videos, disk images, game builds) at maximum internet speed without cloud storage limits.',
    howToUse: [
      'Enable "Direct P2P Transfer (WebRTC)" under Vault Options on the Upload screen.',
      'Send your Transfer Code to the recipient while keeping your browser tab open.',
      'When the recipient connects, data streams directly from your device to theirs.'
    ],
    whatHappensNext: 'Both devices connect via WebRTC data channel. Chunks stream directly to the receiver’s disk without touching server disks.',
    important: 'Both the sender and receiver must keep their browser tabs open during the transfer.',
    whereStored: 'Zero server file storage. File data exists only in browser memory and local disk on the two devices.',
    whenDeleted: 'No server cleanup needed because file data was never stored on the server.',
    example: 'Transferring a 5 GB raw video file directly from your laptop to a colleague’s computer across the office or globe.'
  },
  {
    id: 'steganography_vault',
    icon: ImageIcon,
    title: 'Steganography Image Vault',
    badge: 'Covert Photo Vault',
    badgeColor: 'badge-emerald',
    whatIsIt: 'Invisibly conceals encrypted files inside the pixel color data of a standard PNG photo.',
    whyUseIt: 'Provides plausible deniability and allows sensitive files to bypass strict network inspection and firewalls.',
    howToUse: [
      'Toggle "Steganography Image Vault" ON in Vault Options.',
      'Upload your confidential file (under 10 MB).',
      'The output image looks like a regular picture to human eyes and image viewers.',
      'Recipient enters the code to extract and decrypt the hidden file payload.'
    ],
    whatHappensNext: 'Ciphertext bytes are blended into the least significant bits of image pixels. Deep packet inspection tools only see standard image traffic.',
    important: 'Supported for files up to 10 MB. Requires a carrier image with sufficient pixel resolution.',
    whereStored: 'Carrier image with embedded ciphertext stored temporarily on server until expiry.',
    whenDeleted: 'Deleted automatically when transfer expires or download limit is reached.',
    example: 'Sending a private recovery seed or password list disguised as a vacation photo through a restricted corporate firewall.'
  },
  {
    id: 'zero_knowledge_crypto',
    icon: ShieldCheck,
    title: 'Zero-Knowledge Cryptography',
    badge: 'Military-Grade Security',
    badgeColor: 'badge-primary',
    whatIsIt: 'Client-side AES-256-GCM encryption where your browser locks files before they ever leave your device.',
    whyUseIt: 'Complete privacy. Neither server administrators, cloud hosts, nor internet providers can ever read your files.',
    howToUse: [
      'No extra setup needed — zero-knowledge encryption runs automatically on every transfer.',
      'Your browser generates a 256-bit cryptographic key and unique initialization vector (IV).',
      'The decryption key stays in the URL hash (#key) and is never transmitted to our backend.'
    ],
    whatHappensNext: 'The server receives only scrambled ciphertext. Decryption happens locally inside the recipient’s browser sandbox.',
    important: 'Do not lose your Transfer Code or link; because we do not hold your keys, lost keys cannot be recovered.',
    whereStored: 'Encryption key stays exclusively on client devices (in browser address bar / memory).',
    whenDeleted: 'Key is discarded when you close the browser tab or clear the transfer.',
    example: 'Sharing personal tax documents or medical records with full assurance that no third party can inspect them.'
  },
  {
    id: 'auto_expiry',
    icon: Clock,
    title: 'Code Expiry & Countdown (TTL)',
    badge: '15s to 3 MINUTES',
    badgeColor: 'badge-amber',
    whatIsIt: 'Configurable live countdown timer (15s, 30s, 45s, 60s, 2 min, up to 3 minutes) that automatically deletes files when time runs out.',
    whyUseIt: 'Guarantees ephemeral zero-knowledge privacy with instant sub-second automatic deletion.',
    howToUse: [
      'Select Expiry Countdown on the Upload page: 15s, 30s, 45s, 60s, 2m, or 3m.',
      'The countdown begins as soon as the transfer is created.',
      'When the timer reaches zero, all server ciphertext and sessions are immediately purged.'
    ],
    whatHappensNext: 'Once expired, attempting to use the link or code displays a clear "File Expired — Time limit reached" explanation.',
    important: 'Maximum expiry duration is 3 minutes (180 seconds) for strict ephemeral file transfer security.',
    whereStored: 'Expiry timestamp stored in database index for sub-millisecond automated cleanup.',
    whenDeleted: 'Purged immediately upon reaching the exact expiry timestamp.',
    example: 'Setting a 30-second expiry for a one-time passcode or 3-minute expiry for a large document shared with a recipient.'
  },
  {
    id: 'previews_and_bundles',
    icon: Eye,
    title: 'Rich Previews & Multi-File Bundles',
    badge: 'In-Browser UI',
    badgeColor: 'badge-primary',
    whatIsIt: 'Package multiple files into a single transfer and preview photos, videos, music, PDFs, and code directly in the browser.',
    whyUseIt: 'Inspect file contents safely before saving, or download individual files selectively from a bundle.',
    howToUse: [
      'Select multiple files during upload to create a bundle under a single Transfer Code.',
      'On the Receive screen, click "Preview Files" to open the interactive in-browser viewer.',
      'Download all files at once or save specific files individually.'
    ],
    whatHappensNext: 'Previews are rendered inside a secure browser sandbox without requiring external desktop software.',
    important: 'Previewing does not consume your Burn After Read download count.',
    whereStored: 'Decrypted preview data exists only in temporary browser memory.',
    whenDeleted: 'Preview cache is instantly freed when you close the preview modal or leave the page.',
    example: 'Sending a collection of 10 project design mockups so a client can preview them on their phone without downloading each one first.'
  }
];

/**
 * Data Storage & Privacy Architecture Breakdown
 */
export const DATA_STORAGE_POLICY = {
  title: 'Data Storage & Privacy Architecture',
  summary: 'FileShare is built on a strict zero-knowledge, privacy-first storage model.',
  sections: [
    {
      category: 'Application Metadata',
      storageLocation: 'SQLite Database',
      whatStored: [
        'Transfer ID (random hex identifier)',
        'File name, size, MIME type, and cryptographic checksum',
        'Download count & maximum download limit',
        'Creation time & expiration timestamp',
        'Transfer status (active, ready, uploading, burned)',
        'Zero personal data, zero accounts, zero plaintext passwords'
      ],
      retention: 'Permanently deleted upon transfer expiration or download limit.'
    },
    {
      category: 'File Payload Storage',
      storageLocation: 'Temporary Server Disk (/uploads)',
      whatStored: [
        'AES-256-GCM encrypted ciphertext blob only',
        'Never stored in plaintext — unreadable without the client key',
        'Never stored inside source code, React components, or configuration files'
      ],
      retention: 'Purged immediately upon Burn After Read download, expiration, or sender cancellation.'
    },
    {
      category: 'Temporary Upload Chunks',
      storageLocation: 'Temporary Chunks Folder (/uploads/chunks)',
      whatStored: [
        'Small temporary encrypted slices (256 KB - 2 MB) during in-flight upload streaming'
      ],
      retention: 'Assembled into final blob and immediately deleted when upload completes.'
    },
    {
      category: 'Client / Device Storage',
      storageLocation: 'Browser Memory & LocalStorage',
      whatStored: [
        'Theme preference (light / dark / system) in localStorage',
        'Decryption keys in URL hash (#key) or temporary memory only',
        'Temporary decrypted file blob URLs (revoked on modal close)'
      ],
      retention: 'Memory is cleared immediately when tab is closed or download is completed.'
    }
  ]
};

/**
 * Quick Decision Picker Cards
 */
export const QUICK_PICK_CARDS = [
  {
    icon: Upload,
    title: 'Standard Cloud Share',
    question: 'Need to share files securely with a Transfer Code or QR code?',
    badge: 'Standard Mode',
    badgeColor: 'badge-primary',
    answer: 'Use Cloud Encrypted. It encrypts in your browser, uploads a scrambled blob, and generates an instant Transfer Code and QR code.',
    link: '/upload'
  },
  {
    icon: Flame,
    title: 'Burn After Read',
    question: 'Need the file to self-destruct after 1 or a few downloads?',
    badge: 'Self-Destruct',
    badgeColor: 'badge-amber',
    answer: 'Turn on Burn After Read and choose 1, 5, 10, 30, 60, or 100 downloads. Once reached, all file data is permanently wiped.',
    link: '/upload'
  },
  {
    icon: Radio,
    title: 'WebRTC Direct P2P',
    question: 'Need to send a massive video or folder with zero server storage?',
    badge: 'Device-to-Device',
    badgeColor: 'badge-slate',
    answer: 'Use WebRTC P2P. Both devices connect live and stream data directly between browsers with zero server disk storage.',
    link: '/upload'
  },
  {
    icon: ImageIcon,
    title: 'Steganography Vault',
    question: 'Need to hide a confidential file inside an innocent photo?',
    badge: 'Covert Vault',
    badgeColor: 'badge-emerald',
    answer: 'Use Steganography Vault. It conceals encrypted data inside PNG photo pixels for complete plausible deniability.',
    link: '/upload'
  }
];

/**
 * Comparison Rows
 */
export const COMPARISON_ROWS = [
  {
    feature: 'How Files Are Encrypted',
    cloud: 'In Browser (AES-256-GCM)',
    p2p: 'Peer Channel (AES-256-GCM)',
    stego: 'In Image Pixels (AES-256-GCM)'
  },
  {
    feature: 'Where File Is Stored',
    cloud: 'Temporary Ciphertext Blob',
    p2p: 'None (Direct Device-to-Device)',
    stego: 'Temporary Ciphertext Image'
  },
  {
    feature: 'Max File Size',
    cloud: 'Up to 1 GB',
    p2p: 'Unlimited (Live Stream)',
    stego: 'Up to 10 MB'
  },
  {
    feature: 'Self-Destruct (Burn After Read)',
    cloud: 'Supported (1 to 100 downloads)',
    p2p: 'N/A (Streamed Live)',
    stego: 'Supported (1 to 100 downloads)'
  },
  {
    feature: 'Decryption Key Security',
    cloud: 'Isolated in URL Hash (#key)',
    p2p: 'Private Peer Handshake',
    stego: 'Your Private Password'
  },
  {
    feature: 'Sender Must Stay Online?',
    cloud: 'No (Asynchronous download)',
    p2p: 'Yes (Live direct stream)',
    stego: 'No (Asynchronous download)'
  },
  {
    feature: 'Best Used For',
    cloud: 'Everyday secure sharing',
    p2p: 'Large files & live transfers',
    stego: 'Secret notes & hidden data'
  }
];

/**
 * Frequently Asked Questions
 */
export const FAQS = [
  {
    q: 'What is zero-knowledge encryption and why does it matter?',
    a: 'Zero-knowledge means our servers know nothing about your files. Your computer or phone encrypts the file before uploading. The secret decryption key remains inside your browser address bar (#key=...) and is never sent to our server. We only store an unreadable scrambled blob.'
  },
  {
    q: 'How does Burn After Read work, and what counts as a download?',
    a: 'Burn After Read sets a strict maximum download count (such as 1, 5, 10, 30, 60, or 100 downloads). Only successful, 100% completed downloads reduce the count. If a download is cancelled, interrupted, or previewed, it does not consume a download. Once the limit is reached, all file data is permanently purged.'
  },
  {
    q: 'What happens when a file expires?',
    a: 'When the expiration time (15 to 60 minutes) or download limit is reached, our automated cleanup system permanently deletes the encrypted blob from storage and removes the transfer records. Anyone visiting old links or QR codes will see a friendly "File Expired" notice.'
  },
  {
    q: 'Where is my data stored, and can anyone see it?',
    a: 'Your files are stored only as temporary encrypted blobs on the server until downloaded or expired. They are never stored in plaintext and never shared with advertisers or third parties. No accounts or personal information are ever requested or stored.'
  },
  {
    q: 'Do I need to install an app or register an account?',
    a: 'No. FileShare works entirely inside standard mobile and desktop web browsers (Safari, Chrome, Firefox, Edge). There is zero registration, zero app installation, and zero tracking.'
  },
  {
    q: 'What is the difference between Cloud Encrypted and WebRTC Direct P2P?',
    a: 'Cloud Encrypted allows you to upload and close your browser; the recipient can download whenever convenient. WebRTC Direct P2P streams data straight from your device to the recipient’s device in real-time with zero server storage, perfect for huge files.'
  }
];
