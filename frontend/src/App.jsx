import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Shield, Upload, Download, Menu, X, Lock, Image as ImageIcon, Flame, Key, Zap, MousePointerClick, AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Clock } from 'lucide-react'
import { PageSkeletonLoader } from './components/Skeletons'
import brandLogo from './image/icons.png'
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
              <ShieldCheck size={13} style={{ marginRight: '3px' }} /> E2E ENCRYPTED
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
            <div className="network-badge" data-type={serverOnline === null ? 'checking' : serverOnline ? 'online' : 'offline'}>
              <div className="network-dot"></div>
              <span>
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
          <div className="mobile-menu-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="mobile-menu-drawer" id="mobile-nav-drawer">
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
        {ephemeralStorage && (
          <div className="ephemeral-banner" role="status">
            <AlertTriangle size={18} />
            <span>This host uses temporary serverless storage. Files clear after instance recycling.</span>
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
        <p className="subtitle">
          Your files are locked directly in your browser with AES-256-GCM before uploading.
          Only the person with your transfer code can unlock and open them.
          Codes expire securely within up to 60 minutes.
        </p>

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
            <span>Encrypted in Browser</span>
          </div>
          <div className="highlight-item">
            <CheckCircle2 size={16} className="text-blue" />
            <span>Send Up to 2 GB Free</span>
          </div>
          <div className="highlight-item">
            <Clock size={16} className="text-amber" />
            <span>Expiry Up to 60 Minutes</span>
          </div>
        </div>
      </section>

      {/* How it works - 3 clear steps with exactly ~10 words each */}
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
            <h3 className="step-title">Choose Files</h3>
            <p className="step-desc">
              Select and drop your files. Choose optional self-destruct limits.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number-badge">2</div>
            <div className="step-icon-circle bg-emerald-tint text-emerald">
              <Key size={24} />
            </div>
            <h3 className="step-title">Get Transfer Code</h3>
            <p className="step-desc">
              Browser encrypts data and creates a secure transfer code.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number-badge">3</div>
            <div className="step-icon-circle bg-amber-tint text-amber">
              <Download size={24} />
            </div>
            <h3 className="step-title">Download &amp; Decrypt</h3>
            <p className="step-desc">
              Share code with receiver to decrypt and download files.
            </p>
          </div>
        </div>
      </section>

      {/* Feature cards - Square boxes with ~30 words explanation each */}
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
            <p className="feature-desc">
              Files are encrypted locally using AES-256-GCM before uploading. Your secret encryption key stays on your device and never touches our servers, ensuring complete zero-knowledge data privacy.
            </p>
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
            <p className="feature-desc">
              Hide encrypted files inside normal image pixels. To anyone inspecting network traffic, your transfer looks like an innocent picture, preventing inspection and bypassing strict corporate firewalls effortlessly.
            </p>
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
            <p className="feature-desc">
              Protect sensitive data with automatic file deletion immediately after first download or when the timer expires. Blobs and database records are instantly wiped clean from the server forever.
            </p>
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
            <p className="feature-desc">
              Transfer files directly using a single share code or QR code. No logins, signups, or accounts are required. Recipients simply enter the code to decrypt their files immediately.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App