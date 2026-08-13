import React, { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Shield, Upload, Download, Menu, X, Lock, Image as ImageIcon, Flame, Key, Zap, MousePointerClick } from 'lucide-react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import UploadPage from './pages/Upload'
import DownloadPage from './pages/Download'
import './App.css'

function App() {
  const [serverOnline, setServerOnline] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    detectServer();
  }, []);

  const detectServer = async () => {
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
      setServerOnline(res.ok);
    } catch {
      setServerOnline(false);
    }
  };

  const navLinkClass = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="app">
      <SpeedInsights />
      <div className="ambient-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className="grid-overlay"></div>

      {/* Navigation */}
      <nav className="navbar">
        <Link to="/" className="nav-brand" onClick={() => setMobileOpen(false)}>
          <Shield className="logo-icon" size={24} />
          <span>SecureShare</span>
          <span className="badge">E2E Encrypted</span>
        </Link>

        <div className="nav-links">
          <Link to="/" className={navLinkClass('/')}>
            <Zap size={16} /> Home
          </Link>
          <Link to="/upload" className={navLinkClass('/upload')}>
            <Upload size={16} /> Send a File
          </Link>
          <Link to="/download" className={navLinkClass('/download')}>
            <Download size={16} /> Receive a File
          </Link>
        </div>

        <div className="network-badge" data-type={serverOnline === null ? 'checking' : serverOnline ? 'online' : 'offline'}>
          <div className="network-dot"></div>
          <span>
            {serverOnline === null ? 'Checking server...' : serverOnline ? 'Server Online' : 'Server Offline'}
          </span>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle Navigation"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="mobile-menu-drawer animate-in">
          <div className="mobile-network-status">
            <div className="network-badge" data-type={serverOnline === null ? 'checking' : serverOnline ? 'online' : 'offline'}>
              <div className="network-dot"></div>
              <span>
                {serverOnline === null ? 'Checking server...' : serverOnline ? 'Server Online' : 'Server Offline'}
              </span>
            </div>
          </div>
          <Link to="/" className={navLinkClass('/')} onClick={() => setMobileOpen(false)}>
            <Zap size={18} /> Home
          </Link>
          <Link to="/upload" className={navLinkClass('/upload')} onClick={() => setMobileOpen(false)}>
            <Upload size={18} /> Send a File
          </Link>
          <Link to="/download" className={navLinkClass('/download')} onClick={() => setMobileOpen(false)}>
            <Download size={18} /> Receive a File
          </Link>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<UploadPage serverUrl={serverUrl} />} />
          <Route path="/download/:fileId?" element={<DownloadPage serverUrl={serverUrl} />} />
        </Routes>
      </main>
    </div>
  );
}

function HomePage() {
  return (
    <div className="home-page animate-in">
      <div className="hero">
        <div className="hero-pill">
          <Shield size={14} /> Zero-Knowledge End-to-End Encryption
        </div>
        <h1>Send Files Securely. Nothing Is Stored Unencrypted.</h1>
        <p className="subtitle">
          Upload a file, get a secure code, and share it. Your file is encrypted in your
          browser before it ever leaves your device &mdash; even the server cannot read it.
        </p>

        <div className="cta-buttons">
          <Link to="/upload" className="btn btn-primary btn-lg">
            <Upload size={18} /> Send a File
          </Link>
          <Link to="/download" className="btn btn-secondary btn-lg">
            <Download size={18} /> Receive a File
          </Link>
        </div>
      </div>

      {/* How it works - 3 clear steps */}
      <div className="how-it-works">
        <h2>How it works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <span className="step-number">1</span>
            <MousePointerClick size={22} />
            <h3>Choose your file</h3>
            <p>Drag &amp; drop any file, or click to browse. Pick how long the code stays valid.</p>
          </div>
          <div className="step-card">
            <span className="step-number">2</span>
            <Key size={22} />
            <h3>Get a secure code</h3>
            <p>Your file is encrypted and hidden inside an image in your browser. You receive a private share code.</p>
          </div>
          <div className="step-card">
            <span className="step-number">3</span>
            <Download size={22} />
            <h3>Recipient downloads</h3>
            <p>Anyone with the code can open and decrypt the file. Optional Burn-on-Read deletes it after download.</p>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="bento-grid">
        <div className="bento-card bento-col-6 float-card">
          <div className="bento-icon-wrapper">
            <Lock size={24} />
          </div>
          <div className="bento-badge">Strong Encryption</div>
          <h3>AES-256-GCM in your browser</h3>
          <p className="bento-desc">
            Files are compressed and encrypted with AES-256-GCM using a key derived with
            PBKDF2 (100,000 iterations). The decryption key never leaves your browser.
          </p>
        </div>

        <div className="bento-card bento-col-6 float-card">
          <div className="bento-icon-wrapper">
            <ImageIcon size={24} />
          </div>
          <div className="bento-badge">Steganographic Vault</div>
          <h3>Hidden inside an image</h3>
          <p className="bento-desc">
            Encrypted data is embedded into the pixels of a PNG image. To anyone watching the
            network, your transfer looks like an ordinary picture.
          </p>
        </div>

        <div className="bento-card bento-col-6 float-card">
          <div className="bento-icon-wrapper">
            <Flame size={24} />
          </div>
          <div className="bento-badge">Self-Destruct Option</div>
          <h3>Burn-on-Read</h3>
          <p className="bento-desc">
            Turn it on and the file is permanently deleted from the server the moment it is
            downloaded. One read, then it is gone forever.
          </p>
        </div>

        <div className="bento-card bento-col-6 float-card">
          <div className="bento-icon-wrapper">
            <Key size={24} />
          </div>
          <div className="bento-badge">Simple Sharing</div>
          <h3>One code, done</h3>
          <p className="bento-desc">
            After sending, you get a single share code like <code>SEC-4BE819D7-9F8A73C2</code>.
            Send it to anyone - they paste it on the Receive page and download your file.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App