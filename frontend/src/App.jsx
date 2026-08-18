import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Shield, Upload, Download, Menu, X, Lock, Image as ImageIcon, Flame, Key, Zap, MousePointerClick, AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Clock } from 'lucide-react'
import { PageSkeletonLoader } from './components/Skeletons'
import brandLogo from './image/icons.png'
import { api } from './services/api'
import './App.css'

// Only load Vercel analytics when deployed on Vercel
const SpeedInsights = import.meta.env.VITE_VERCEL_ANALYTICS
  ? lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })))
  : () => null

// Route-level code splitting
const UploadPage = lazy(() => import('./pages/Upload'))
const DownloadPage = lazy(() => import('./pages/Download'))

function App() {
  const [serverOnline, setServerOnline] = useState(null);
  const [ephemeralStorage, setEphemeralStorage] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('fileshare_banner_dismissed') === '1';
    } catch (_) {
      return false;
    }
  });
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
      const health = await api.health();
      if (!health || health.status !== 'healthy') throw new Error('Health check failed');
      setServerOnline(true);
      setEphemeralStorage(health.persistent_storage === false);
    } catch (err) {
      setServerOnline(false);
      setEphemeralStorage(false);
    }
  };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem('fileshare_banner_dismissed', '1');
    } catch (_) {}
  };

  const navLinkClass = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="app">
      <SpeedInsights />

      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="nav-brand" onClick={() => setMobileOpen(false)}>
            <div className="nav-brand-icon">
              <img src={brandLogo} alt="FileShare Logo" className="brand-logo-img" />
            </div>
            <div className="brand-title-group">
              <span className="brand-text">FileShare</span>
              <span className="brand-quote-badge">Send, Share and Done</span>
            </div>
              <span className="badge badge-primary nav-e2e-badge">
                <ShieldCheck size={13} className="badge-icon" /> E2E ENCRYPTED
            </span>
          </Link>

          <div className="nav-links">
            <Link to="/" className={navLinkClass('/')}>
              <Zap size={16} /> Home
            </Link>
            <Link to="/upload" className={navLinkClass('/upload')}>
              <Upload size={16} /> Send Files
            </Link>
            <Link to="/download" className={navLinkClass('/download')}>
              <Download size={16} /> Receive Files
            </Link>
          </div>

          <div className="nav-right">
            <div className="network-badge network-badge-compact" data-type={serverOnline === null ? 'checking' : serverOnline ? 'online' : 'offline'} aria-live="polite">
              <div className="network-dot"></div>
              <span className="network-label">
                {serverOnline === null ? 'Checking...' : serverOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle Navigation"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer with Backdrop */}
      {mobileOpen && (
        <>
          <button className="mobile-menu-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" />
          <div className="mobile-menu-drawer" id="mobile-nav-drawer" role="dialog" aria-label="Navigation menu">
            <div className="mobile-drawer-brand">
              <img src={brandLogo} alt="FileShare Logo" className="brand-logo-img" />
              <div>
                <div className="brand-text">FileShare</div>
                <div className="brand-quote-drawer">Send, Share and Done</div>
              </div>
            </div>

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
        {ephemeralStorage && !bannerDismissed && (
          <div className="ephemeral-banner animate-in" role="status">
            <div className="ephemeral-banner-content">
              <AlertTriangle size={18} className="ephemeral-banner-icon" />
              <span>This host uses temporary serverless storage. Files clear after instance recycling.</span>
            </div>
            <button
              className="ephemeral-banner-dismiss"
              onClick={handleDismissBanner}
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
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

      {/* Flat Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="footer-logo">
              <img src={brandLogo} alt="FileShare Logo" className="footer-logo-img" />
              <span>FileShare</span>
            </div>
            <p className="footer-quote-text">
              <strong>Send, Share and Done.</strong> Zero-knowledge, browser-encrypted file sharing. No accounts required.
            </p>
          </div>
          <div className="footer-links">
            <Link to="/"><Zap size={14} /> Home</Link>
            <Link to="/upload"><Upload size={14} /> Send Files</Link>
            <Link to="/download"><Download size={14} /> Receive Files</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HomePage() {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge-container">
          <img src={brandLogo} alt="FileShare 3D Icon" className="hero-3d-icon" />
          <div className="hero-pill">
            <ShieldCheck size={15} /> Send, Share and Done &bull; 100% Private
          </div>
        </div>
        <h1 className="hero-title">
          Send Files Safely.<br />
          <span className="hero-highlight">Send, Share and Done.</span>
        </h1>
        <div className="hero-points-list">
          <div className="hero-point-item">
            <CheckCircle2 size={16} className="text-emerald" />
            <span><strong>Zero-Knowledge:</strong> Encrypted in browser with AES-256-GCM</span>
          </div>
          <div className="hero-point-item">
            <CheckCircle2 size={16} className="text-blue" />
            <span><strong>Device Keys:</strong> Decryption key never touches the server</span>
          </div>
          <div className="hero-point-item">
            <Clock size={16} className="text-amber" />
            <span><strong>Auto-Expire:</strong> Self-destructs within 60 mins or on first read</span>
          </div>
          <div className="hero-point-item">
            <Sparkles size={16} className="text-emerald" />
            <span><strong>Stream &amp; Batch:</strong> 256 KB slices &amp; 2 MB batches in memory</span>
          </div>
          <div className="hero-point-item">
            <ShieldCheck size={16} className="text-blue" />
            <span><strong>Direct to Disk:</strong> Streams decrypted data without RAM overflow</span>
          </div>
          <div className="hero-point-item">
            <Lock size={16} className="text-slate" />
            <span><strong>Zero Data Retention:</strong> No accounts, logs, or stored plaintext</span>
          </div>
        </div>

        <div className="cta-buttons">
          <Link to="/upload" className="btn btn-primary btn-lg">
            <Upload size={18} /> Send Files <ArrowRight size={16} />
          </Link>
          <Link to="/download" className="btn btn-secondary btn-lg">
            <Download size={18} /> Receive Files
          </Link>
        </div>

        {/* Quick Highlights Bar */}
        <div className="highlights-bar">
          <div className="highlight-item">
            <CheckCircle2 size={16} className="text-emerald" />
            <span>256 KB Slicing &amp; 2 MB Batches</span>
          </div>
          <div className="highlight-item">
            <CheckCircle2 size={16} className="text-blue" />
            <span>Send Up to 2 GB Free</span>
          </div>
          <div className="highlight-item">
            <Clock size={16} className="text-amber" />
            <span>Direct-to-Disk Streaming</span>
          </div>
        </div>
      </section>

      {/* How it works - 3 clear steps */}
      <section className="how-it-works-section">
        <div className="section-header">
          <span className="section-tag">SIMPLE WORKFLOW</span>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Three easy steps to share your files securely.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number-badge">1</div>
            <div className="step-icon-circle bg-blue-tint text-blue">
              <MousePointerClick size={24} />
            </div>
            <h3 className="step-title">1. Choose Files</h3>
            <ul className="step-points-list">
              <li>Select &amp; drop files (up to 2 GB)</li>
              <li>Set self-destruct &amp; expiry timers</li>
              <li>Streamed in 256 KB memory-safe chunks</li>
            </ul>
          </div>

          <div className="step-card">
            <div className="step-number-badge">2</div>
            <div className="step-icon-circle bg-emerald-tint text-emerald">
              <Key size={24} />
            </div>
            <h3 className="step-title">2. Get Transfer Code</h3>
            <ul className="step-points-list">
              <li>Browser encrypts via AES-256-GCM</li>
              <li>One-click 6-digit code &amp; QR link</li>
              <li>Server only receives ciphertext blobs</li>
            </ul>
          </div>

          <div className="step-card">
            <div className="step-number-badge">3</div>
            <div className="step-icon-circle bg-amber-tint text-amber">
              <Download size={24} />
            </div>
            <h3 className="step-title">3. Download &amp; Decrypt</h3>
            <ul className="step-points-list">
              <li>Receiver inputs code / scans QR</li>
              <li>Streams decrypted batches directly to disk</li>
              <li>In-browser preview for media &amp; docs</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Feature cards - 4 Core Security Pillars */}
      <section className="features-section">
        <div className="section-header">
          <span className="section-tag">CORE SECURITY</span>
          <h2 className="section-title">Built for Absolute Privacy</h2>
          <p className="section-subtitle">Every feature is designed with zero-trust architecture.</p>
        </div>

        <div className="features-grid">
          {/* Box 1: Blue */}
          <div className="feature-box feature-box-blue">
            <div className="feature-top">
              <div className="feature-icon-circle bg-white text-blue">
                <Lock size={24} />
              </div>
              <span className="feature-badge badge-blue">PURE PRIVACY</span>
            </div>
            <h3 className="feature-title">Browser-Only Encryption</h3>
            <ul className="feature-points-list">
              <li>AES-256-GCM military-grade cipher</li>
              <li>Hardware-accelerated Web Crypto API</li>
              <li>Key never leaves device (URL #hash)</li>
              <li>Server stores zero plaintext data</li>
            </ul>
          </div>

          {/* Box 2: Emerald */}
          <div className="feature-box feature-box-emerald">
            <div className="feature-top">
              <div className="feature-icon-circle bg-white text-emerald">
                <ImageIcon size={24} />
              </div>
              <span className="feature-badge badge-emerald">IMAGE VAULT</span>
            </div>
            <h3 className="feature-title">Steganography Vault</h3>
            <ul className="feature-points-list">
              <li>Invisible LSB pixel injection in PNGs</li>
              <li>Hides encrypted files inside normal images</li>
              <li>Bypasses network traffic inspection</li>
              <li>Secret extraction with master password</li>
            </ul>
          </div>

          {/* Box 3: Amber */}
          <div className="feature-box feature-box-amber">
            <div className="feature-top">
              <div className="feature-icon-circle bg-white text-amber">
                <Flame size={24} />
              </div>
              <span className="feature-badge badge-amber">SELF-DESTRUCT</span>
            </div>
            <h3 className="feature-title">Burn-On-Read &amp; Expiry</h3>
            <ul className="feature-points-list">
              <li>Instant file purge on first download</li>
              <li>Configurable 60-minute TTL expiry</li>
              <li>Automated background cleanup worker</li>
              <li>Zero leftover residue on server disk</li>
            </ul>
          </div>

          {/* Box 4: Slate/Purple */}
          <div className="feature-box feature-box-slate">
            <div className="feature-top">
              <div className="feature-icon-circle bg-white text-slate">
                <Key size={24} />
              </div>
              <span className="feature-badge badge-slate">INSTANT ACCESS</span>
            </div>
            <h3 className="feature-title">One-Code Instant Share</h3>
            <ul className="feature-points-list">
              <li>Zero friction across mobile &amp; desktop</li>
              <li>5x QR token refresh security limit</li>
              <li>SHA-256 cryptographic access proof</li>
              <li>No logins, sign-ups, or personal data</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App
