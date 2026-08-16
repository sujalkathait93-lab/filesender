import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Shield, Upload, Download, Menu, X, Lock, Image as ImageIcon, Flame, Key, Zap, MousePointerClick, AlertTriangle } from 'lucide-react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { PageSkeletonLoader } from './components/Skeletons'
import './App.css'

// Route-level code splitting: crypto/steganography/QR code only load when needed
const UploadPage = lazy(() => import('./pages/Upload'))
const DownloadPage = lazy(() => import('./pages/Download'))

function App() {
  const [serverOnline, setServerOnline] = useState(null);
  const [ephemeralStorage, setEphemeralStorage] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    detectServer();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add('body-scroll-locked');
    } else {
      document.body.classList.remove('body-scroll-locked');
    }
    return () => document.body.classList.remove('body-scroll-locked');
  }, [mobileOpen]);

  const detectServer = async () => {
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
      setServerOnline(res.ok);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        setEphemeralStorage(body && body.persistent_storage === false);
      }
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
        <div className="navbar-container">
          <Link to="/" className="nav-brand" onClick={() => setMobileOpen(false)}>
            <Shield className="logo-icon" size={22} />
            <span>FileShare</span>
            <span className="badge">E2E Encrypted</span>
          </Link>

          <div className="nav-links">
            <Link to="/" className={navLinkClass('/')}>
              <Zap size={15} /> Home
            </Link>
            <Link to="/upload" className={navLinkClass('/upload')}>
              <Upload size={15} /> Send Files
            </Link>
            <Link to="/download" className={navLinkClass('/download')}>
              <Download size={15} /> Receive Files
            </Link>
          </div>

          <div className="nav-right">
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
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer with Backdrop */}
      {mobileOpen && (
        <>
          <div className="mobile-menu-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="mobile-menu-drawer animate-in" id="mobile-nav-drawer">
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
              <Upload size={18} /> Send Files
            </Link>
            <Link to="/download" className={navLinkClass('/download')} onClick={() => setMobileOpen(false)}>
              <Download size={18} /> Receive Files
            </Link>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main-content">
        {ephemeralStorage && (
          <div className="ephemeral-banner" role="status">
            <AlertTriangle size={16} />
            This host uses ephemeral storage. Files can disappear across deploys or instances. Prefer a VM with durable disk for real transfers.
          </div>
        )}
        <Suspense fallback={<PageSkeletonLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/download/:fileId?" element={<DownloadPage />} />
          </Routes>
        </Suspense>
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
          Upload single or multiple files, get a secure code, and share it. Your files are encrypted in your
          browser before leaving your device &mdash; even the server cannot read them.
        </p>

        <div className="cta-buttons">
          <Link to="/upload" className="btn btn-primary btn-lg">
            <Upload size={18} /> Send Files
          </Link>
          <Link to="/download" className="btn btn-secondary btn-lg">
            <Download size={18} /> Receive Files
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
            <h3>Choose your files</h3>
            <p>Drag &amp; drop single or multiple files (up to 2 GB). Configure download limits and expiry.</p>
          </div>
          <div className="step-card">
            <span className="step-number">2</span>
            <Key size={22} />
            <h3>Get a transfer code</h3>
            <p>Files are compressed and encrypted client-side with AES-256-GCM. You receive a single code and QR.</p>
          </div>
          <div className="step-card">
            <span className="step-number">3</span>
            <Download size={22} />
            <h3>Recipient downloads</h3>
            <p>Access via QR or Transfer Code. Safe 30s preview and batch download for all unpacked files.</p>
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
            Encrypted data can be embedded into the pixels of a PNG image. To anyone watching the
            network, your transfer looks like an ordinary picture.
          </p>
        </div>

        <div className="bento-card bento-col-6 float-card">
          <div className="bento-icon-wrapper">
            <Flame size={24} />
          </div>
          <div className="bento-badge">Self-Destruct Option</div>
          <h3>Burn-on-Read & Limits</h3>
          <p className="bento-desc">
            Choose unlimited downloads until expiry, or set a download limit (1 to 100).
            With Burn-on-Read, the file is deleted from the server immediately upon download.
          </p>
        </div>

        <div className="bento-card bento-col-6 float-card">
          <div className="bento-icon-wrapper">
            <Key size={24} />
          </div>
          <div className="bento-badge">Simple Sharing</div>
          <h3>One code, done</h3>
          <p className="bento-desc">
            Anyone with the full code (id + password) can download. File ID alone is not enough.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App