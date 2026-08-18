import {
  Upload, Download, ShieldCheck, Lock, Radio, Image as ImageIcon,
  Flame, Key, Zap, CheckCircle2, Eye, FileText, Sparkles,
  Layers, Check, HelpCircle, Archive, Video, Music, FileCode, Disc
} from 'lucide-react'

export const TRANSFER_MODES = [
  {
    id: 'cloud',
    title: 'Cloud Encrypted',
    subtitle: 'Standard Share',
    icon: Upload,
    badge: 'Recommended',
    badgeColor: 'badge-primary',
    simpleSummary: 'Lock your files in your browser and share with a Transfer Code or QR code.',
    bestFor: 'Any files up to 1 GB (PDFs, docs, photos, videos, ZIPs)',
    steps: [
      {
        number: 1,
        title: 'Choose Your Files',
        desc: 'Drag and drop your files or click to browse. Files stay on your device until encrypted.',
        tip: 'Works with single files or entire multi-file bundles up to 1 GB.'
      },
      {
        number: 2,
        title: 'Set Privacy Options',
        desc: 'Choose Burn-on-Read (self-destructs after 1st download) and set an expiry time (15 to 60 mins).',
        tip: 'Once expired, files are automatically wiped forever.'
      },
      {
        number: 3,
        title: 'Browser Locks Files',
        desc: 'Your browser generates a secret military-grade key and encrypts the file before uploading.',
        tip: 'The secret key stays in the URL hash (#key) and is never sent to our server.'
      },
      {
        number: 4,
        title: 'Share Code or QR',
        desc: 'Share your Transfer Code (e.g. FS-XXXX-XXXX) or dynamic QR code with the recipient.',
        tip: 'The recipient just enters the Transfer Code or scans the QR code to download.'
      }
    ],
    actionLink: '/upload',
    actionText: 'Send Encrypted Files'
  },
  {
    id: 'p2p',
    title: 'WebRTC Direct P2P',
    subtitle: 'Device-to-Device',
    icon: Radio,
    badge: 'Zero Server Storage',
    badgeColor: 'badge-slate',
    simpleSummary: 'Send files straight from your device to the recipient with zero server storage.',
    bestFor: 'Huge files (large 4K videos, game files, ISOs) when both people are online',
    steps: [
      {
        number: 1,
        title: 'Turn on WebRTC P2P',
        desc: 'In the Upload screen, toggle the "WebRTC P2P Mode" switch to start a live session.',
        tip: 'No file bytes will be saved on any server disk.'
      },
      {
        number: 2,
        title: 'Connect with Recipient',
        desc: 'Your browser creates a live peer room. Send the code/link to the other person.',
        tip: 'Both people just need to keep their browser tab open during transfer.'
      },
      {
        number: 3,
        title: 'Direct Stream Begins',
        desc: 'Data flows directly between your device and their device at maximum internet speed.',
        tip: 'Automatic retry automatically re-sends any dropped packets.'
      },
      {
        number: 4,
        title: 'Saved Straight to Disk',
        desc: 'The receiving browser saves incoming chunks directly to their download folder.',
        tip: 'No browser memory limit because chunks write straight to disk.'
      }
    ],
    actionLink: '/upload',
    actionText: 'Start P2P Transfer'
  },
  {
    id: 'stego',
    title: 'Steganography Vault',
    subtitle: 'Hide in Photos',
    icon: ImageIcon,
    badge: 'Invisible Cloak',
    badgeColor: 'badge-emerald',
    simpleSummary: 'Invisibly conceal sensitive files inside the pixels of an ordinary PNG photo.',
    bestFor: 'Secret notes, passwords, private keys, and files requiring plausible deniability',
    steps: [
      {
        number: 1,
        title: 'Select Steganography',
        desc: 'Turn on "Steganography Vault" under Vault Options when preparing your upload.',
        tip: 'Provide any regular PNG carrier image with enough pixel size.'
      },
      {
        number: 2,
        title: 'Embed Secret Inside Pixels',
        desc: 'Your file is encrypted and hidden inside the microscopic pixel colors of the photo.',
        tip: 'The output looks completely like a normal picture to the human eye.'
      },
      {
        number: 3,
        title: 'Bypass Firewalls & Scanners',
        desc: 'Network filters and inspection tools only see standard image traffic.',
        tip: 'Nobody inspecting the network can tell a secret file is inside.'
      },
      {
        number: 4,
        title: 'Extract with Passphrase',
        desc: 'The recipient uploads the photo and types the password to extract the hidden file.',
        tip: 'Only someone with the correct passphrase can unlock the data.'
      }
    ],
    actionLink: '/upload',
    actionText: 'Try Stego Vault'
  },
  {
    id: 'receive',
    title: 'Receive & Decrypt',
    subtitle: 'Preview & Download',
    icon: Download,
    badge: 'No Account Needed',
    badgeColor: 'badge-amber',
    simpleSummary: 'Enter a Transfer Code or scan a QR code to preview and download your files instantly.',
    bestFor: 'Anyone receiving files on computer, tablet, or phone',
    steps: [
      {
        number: 1,
        title: 'Enter Transfer Code or QR',
        desc: 'Paste your Transfer Code (e.g. FS-XXXX-XXXX) into the Receive box, or scan the QR code.',
        tip: 'The transfer code automatically provides the file identifier and decryption key.'
      },
      {
        number: 2,
        title: 'Instant In-Browser Unlock',
        desc: 'Your browser uses hardware acceleration to decrypt the file safely in your sandbox.',
        tip: 'Decryption happens on your device, not in the cloud.'
      },
      {
        number: 3,
        title: 'Inspect Live Preview',
        desc: 'Preview photos, play videos and music, or read PDFs and code before downloading.',
        tip: 'Choose which files you want to save or download all in one click.'
      },
      {
        number: 4,
        title: 'Save to Your Device',
        desc: 'Files save directly into your computer or phone download folder.',
        tip: 'If Burn-on-Read was set, the file deletes from the server immediately after.'
      }
    ],
    actionLink: '/download',
    actionText: 'Receive a File'
  }
];

export const FEATURES_LIST = [
  {
    icon: ShieldCheck,
    title: 'Zero-Knowledge Cryptography',
    simpleText: 'Your files are locked on your device before leaving your computer.',
    tag: 'Military-Grade Lock',
    points: [
      'Key is generated in your browser: The server never receives or stores your encryption key.',
      'AES-256-GCM standard: High-grade authenticated encryption standard for maximum data security.',
      'URL Hash (#key): Key remains isolated in the browser address bar and is never transmitted to servers.'
    ],
    bestForFormats: [
      { label: 'PDFs & Docs', ext: '.pdf, .docx' },
      { label: 'ID Scans', ext: '.png, .jpg' },
      { label: 'Keys & Passwords', ext: '.txt, .env' },
      { label: 'ZIP Bundles', ext: '.zip' }
    ]
  },
  {
    icon: Layers,
    title: 'Stream & Batch Pipeline',
    simpleText: 'Files are processed in memory-safe chunks so your browser never freezes or crashes.',
    tag: 'Smooth & Fast',
    points: [
      '256 KB slices: Large files are sliced progressively to prevent browser RAM overload.',
      '2 MB batches: Groups 8 chunks together for per-batch authenticated encryption.',
      'Direct-to-Disk: Writes incoming streams directly to storage via File System Access API.'
    ],
    bestForFormats: [
      { label: '4K/HD Videos', ext: '.mp4, .mkv' },
      { label: 'Large Archives', ext: '.zip, .rar, .7z' },
      { label: 'System Images', ext: '.iso, .img' }
    ]
  },
  {
    icon: Flame,
    title: 'Burn-on-Read & Auto-Expiry',
    simpleText: 'Self-destructing file transfer that leaves zero residual trace on the server.',
    tag: 'Self-Destruct',
    points: [
      'Instant Wipe: File is permanently deleted immediately after the first successful download.',
      'Auto-Purge Timers: Configurable 15, 30, 45, or 60-minute time-to-live expiration.',
      'Zero Server Trace: All database records and temporary encrypted blobs are purged.'
    ],
    bestForFormats: [
      { label: 'Confidential PDFs', ext: '.pdf' },
      { label: 'Identity Documents', ext: '.jpg, .png' },
      { label: 'Credentials & Seeds', ext: '.txt, .env' },
      { label: 'Single-Use ZIPs', ext: '.zip' }
    ]
  },
  {
    icon: ImageIcon,
    title: 'Steganography Image Vault',
    simpleText: 'Invisibly conceals encrypted secret payloads inside ordinary carrier photos.',
    tag: 'Covert Vault',
    points: [
      'Pixel LSB encoding: Embeds ciphertext bits into microscopic pixel color variations.',
      'Bypasses network filters: Deep packet inspection (DPI) sees ordinary image traffic.',
      'Password protected: Data extraction requires the correct decryption passphrase.'
    ],
    bestForFormats: [
      { label: 'Carrier Image', ext: '.png' },
      { label: 'Hidden Documents', ext: '.pdf, .txt' },
      { label: 'Hidden Code', ext: '.js, .py' },
      { label: 'Small Archives', ext: '.zip' }
    ]
  },
  {
    icon: Radio,
    title: 'WebRTC Direct P2P Transfer',
    simpleText: 'Direct device-to-device data streaming with zero intermediate server storage.',
    tag: 'Device-to-Device',
    points: [
      'Peer-to-peer data channel: Streams directly between sender and receiver browsers.',
      'Unlimited file capacity: Not restricted by cloud server storage constraints.',
      'Real-time flow control: Automatically regulates throughput and retries dropped chunks.'
    ],
    bestForFormats: [
      { label: 'Massive Videos', ext: '.mp4, .mov' },
      { label: 'Project Folders', ext: '.zip, .tar' },
      { label: 'Disk Images', ext: '.iso, .dmg' },
      { label: 'App Installers', ext: '.exe, .pkg' }
    ]
  },
  {
    icon: Eye,
    title: 'Rich Previews & Multi-File Bundles',
    simpleText: 'Send entire file collections together and inspect them directly in the browser.',
    tag: 'In-Browser UI',
    points: [
      'Multi-file bundles: Package and transfer multiple files under a single transfer session.',
      'In-browser player: Preview images, play audio and video, read PDFs, and inspect code syntax.',
      'Flexible saving: Download individual files selectively or save everything in one click.'
    ],
    bestForFormats: [
      { label: 'Photo Sets', ext: '.jpg, .png, .webp' },
      { label: 'Audio Tracks', ext: '.mp3, .wav' },
      { label: 'Video Clips', ext: '.mp4' },
      { label: 'Documents & Code', ext: '.pdf, .js, .py' }
    ]
  }
];

export const QUICK_PICK_CARDS = [
  {
    icon: Upload,
    title: 'Standard Cloud Share',
    question: 'Need to share a file securely with a Transfer Code or QR?',
    badge: 'Standard Mode',
    badgeColor: 'badge-primary',
    answer: 'Use Cloud Encrypted. It encrypts in your browser, uploads a scrambled blob, and generates an instant Transfer Code and QR code.',
    link: '/upload'
  },
  {
    icon: Radio,
    title: 'WebRTC Direct P2P',
    question: 'Need to send a massive video or folder with zero server limits?',
    badge: 'Device-to-Device',
    badgeColor: 'badge-slate',
    answer: 'Use WebRTC P2P. Both devices connect live and stream directly with zero intermediate server disk storage.',
    link: '/upload'
  },
  {
    icon: ImageIcon,
    title: 'Steganography Vault',
    question: 'Need to hide a confidential file inside an innocent photo?',
    badge: 'Covert Vault',
    badgeColor: 'badge-emerald',
    answer: 'Use Steganography Vault. It blends encrypted data into the pixels of a PNG image for complete plausible deniability.',
    link: '/upload'
  },
  {
    icon: Flame,
    title: 'Burn-on-Read',
    question: 'Need the file to self-destruct immediately after first download?',
    badge: 'Self-Destruct',
    badgeColor: 'badge-amber',
    answer: 'Turn on Burn-on-Read during upload. The moment the file is downloaded once, it is permanently wiped forever.',
    link: '/upload'
  }
];

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
    stego: 'Carrier Image Capacity'
  },
  {
    feature: 'Self-Destruct (Burn-on-Read)',
    cloud: 'Supported (Instant Wipe)',
    p2p: 'N/A (Streamed Live)',
    stego: 'Supported (Instant Wipe)'
  },
  {
    feature: 'Decryption Key Security',
    cloud: 'Isolated in URL Hash (#key)',
    p2p: 'Private Peer Handshake',
    stego: 'Your Private Password'
  },
  {
    feature: 'Best Used For',
    cloud: 'Everyday secure sharing',
    p2p: 'Large files & live transfers',
    stego: 'Secret notes & hidden data'
  }
];

export const FAQS = [
  {
    q: 'How does zero-knowledge encryption work in simple terms?',
    a: 'Zero-knowledge means our servers know nothing about your file contents. Your computer encrypts the file with a secret key before sending it. The key stays inside your browser address bar (#key=...) and is never transmitted to the server. Server databases only store unreadable ciphertext blobs.'
  },
  {
    q: 'What is Burn-on-Read, and how does it protect me?',
    a: 'Burn-on-Read is an automated self-destruction protocol. The instant the recipient completes the first download, the server permanently purges the file record from database and storage. The transfer code becomes invalid immediately.'
  },
  {
    q: 'What is the difference between Cloud Encrypted and WebRTC P2P?',
    a: 'Cloud Encrypted allows asynchronous transfers where you upload and share the code so the receiver can download whenever convenient. WebRTC P2P is a direct live pipe between two active devices where data streams straight from device to device without server storage.'
  },
  {
    q: 'How does the Steganography Vault hide files in photos?',
    a: 'It embeds the encrypted file into the microscopic color bits of a PNG carrier image. The photo displays normally in any image viewer, but contains your hidden, password-protected file payload inside.'
  },
  {
    q: 'Do I need to create an account or install any software?',
    a: 'No. FileShare runs entirely in standard web browsers across desktop and mobile devices. No registration, account creation, or software installation is required.'
  },
  {
    q: 'Can the server owner or internet provider read my files?',
    a: 'No. Because encryption occurs client-side in your browser before data transmission, neither server operators, hosting providers, nor network intermediaries have access to your plaintext files or keys.'
  }
];
