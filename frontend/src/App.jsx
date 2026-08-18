import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Shield, Upload, Download, Lock, Image as ImageIcon,
  Flame, Key, Zap, MousePointerClick, AlertTriangle, ArrowRight,
  CheckCircle2, ShieldCheck, Sparkles, Clock, Sun, Moon, Monitor, Radio
} from 'lucide-react'
import { PageSkeletonLoader } from './components/Skeletons'
import { useTheme } from './context/ThemeContext'
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

  const { theme, resolvedTheme, setTheme } = useTheme();
  const location = useLocation();

  useEffect(() => {
    detectServer();
  }, []);

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

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const navLinkClass = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="app">
      <SpeedInsights />

      {/* Top Header Navigation */}
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="nav-brand" aria-label="FileShare Home">
            <div className="nav-brand-icon">
              <img src={brandLogo} alt="FileShare Logo" className="brand-logo-img" />
            </div>
            <div className="brand-title-group">
              <span className="brand-text">FileShare</span>
              <span className="brand-quote-badge">Send, Share and Done</span>
            </div>
          </Link>

          {/* Desktop Segmented Navigation */}
          <div className="nav-segmented" role="navigation" aria-label="Main Navigation">
            <Link to="/" className={`nav-segmented-link ${navLinkClass('/')}`}>
              <Zap size={15} /> Home
            </Link>
            <Link to="/upload" className={`nav-segmented-link ${navLinkClass('/upload')}`}>
              <Upload size={15} /> Send Files
            </Link>
            <Link to="/download" className={`nav-segmented-link ${navLinkClass('/download')}`}>
              <Download size={15} /> Receive Files
            </Link>
          </div>

          <div className="nav-right">
            <div
              className="network-badge"
              data-type={serverOnline === null ? 'checking' : serverOnline ? 'online' : 'offline'}
              aria-live="polite"
              title={serverOnline ? 'Backend server connected' : 'Connecting to server...'}
            >
              <div className="network-dot"></div>
              <span>{serverOnline === null ? 'Checking' : serverOnline ? 'Online' : 'Offline'}</span>
            </div>

            <button
              className="theme-toggle-btn"
              onClick={cycleTheme}
              aria-label={`Current theme: ${theme}. Click to change.`}
              title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} (Click to switch)`}
            >
              {theme === 'system' ? (
                <Monitor size={16} />
              ) : resolvedTheme === 'dark' ? (
                <Moon size={16} />
              ) : (
                <Sun size={16} />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {ephemeralStorage && !bannerDismissed && (
          <div className="ephemeral-banner animate-in" role="status">
            <div className="ephemeral-banner-content">
              <AlertTriangle size={18} />
              <span>This host uses temporary serverless storage. Files clear after instance recycling.</span>
            </div>
            <button
              className="ephemeral-banner-dismiss"
              onClick={handleDismissBanner}
              aria-label="Dismiss banner"
            >
              &times;
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

      {/* Mobile Bottom Navigation Bar (iOS / Android Native Feel) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <Link to="/" className={`mobile-nav-item ${navLinkClass('/')}`}>
          <Zap size={20} />
          <span>Home</span>
        </Link>
        <Link to="/upload" className={`mobile-nav-item ${navLinkClass('/upload')}`}>
          <Upload size={20} />
          <span>Send</span>
        </Link>
        <Link to="/download" className={`mobile-nav-item ${navLinkClass('/download')}`}>
          <Download size={20} />
          <span>Receive</span>
        </Link>
      </nav>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="footer-logo">
              <img src={brandLogo} alt="FileShare Logo" className="footer-logo-img" />
              <span>FileShare</span>
            </div>
            <p className="footer-quote-text">
              Zero-knowledge, browser-encrypted file sharing. Send, Share and Done.
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
    <div className="home-page animate-in">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge-container">
          <div className="hero-pill">
            <ShieldCheck size={14} /> Zero-Knowledge &bull; AES-256-GCM
          </div>
        </div>
        <h1 className="hero-title">
          Send Files Safely.<br />
          <span className="hero-highlight">Send, Share and Done.</span>
        </h1>
        <p className="hero-subtitle">
          Hardware-accelerated browser encryption. Decryption keys never touch our servers. Instant codes, zero registrations.
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
            <CheckCircle2 size={15} />
            <span>256 KB Slicing &amp; 2 MB Batches</span>
          </div>
          <div className="highlight-item">
            <CheckCircle2 size={15} />
            <span>Up to 2 GB Transfer</span>
          </div>
          <div className="highlight-item">
            <CheckCircle2 size={15} />
            <span>Direct-to-Disk Streaming</span>
          </div>
        </div>
      </section>

      {/* How It Works - 3 Step Linear Workflow */}
      <section className="workflow-section">
        <div className="section-header">
          <span className="section-tag">STREAMLINED WORKFLOW</span>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Three clean steps to exchange encrypted files.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number-badge">1</div>
            <div className="step-icon-circle">
              <MousePointerClick size={20} />
            </div>
            <h3 className="step-title">Select Files</h3>
            <ul className="step-points-list">
              <li>Drag &amp; drop single or multiple files (up to 2 GB)</li>
              <li>Configure Burn-on-Read or 15–60 min expiry</li>
              <li>Streamed in memory-safe 256 KB chunks</li>
            </ul>
          </div>

          <div className="step-card">
            <div className="step-number-badge">2</div>
            <div className="step-icon-circle">
              <Key size={20} />
            </div>
            <h3 className="step-title">Get Transfer Code</h3>
            <ul className="step-points-list">
              <li>Encrypted in-browser using Web Crypto API</li>
              <li>Instant 6-digit alphanumeric code &amp; QR link</li>
              <li>Server only receives ciphertext blobs</li>
            </ul>
          </div>

          <div className="step-card">
            <div className="step-number-badge">3</div>
            <div className="step-icon-circle">
              <Download size={20} />
            </div>
            <h3 className="step-title">Download &amp; Stream</h3>
            <ul className="step-points-list">
              <li>Recipient enters code or opens share link</li>
              <li>In-browser preview for media, audio &amp; docs</li>
              <li>Streams decrypted payload directly to disk</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Core Security & Architecture Pillars */}
      <section className="security-section">
        <div className="section-header">
          <span className="section-tag">SECURITY FOUNDATION</span>
          <h2 className="section-title">Built with Zero-Trust Architecture</h2>
          <p className="section-subtitle">Engineered for absolute confidentiality and performance.</p>
        </div>

        <div className="features-grid">
          <div className="feature-box">
            <div className="feature-top">
              <div className="feature-icon-circle">
                <Lock size={20} />
              </div>
              <span className="badge badge-primary">END-TO-END</span>
            </div>
            <h3 className="feature-title">Browser-Only Cryptography</h3>
            <ul className="feature-points-list">
              <li>AES-256-GCM authenticated encryption</li>
              <li>Decryption key stays in client URL hash (#)</li>
              <li>Zero server plaintext storage or logging</li>
            </ul>
          </div>

          <div className="feature-box">
            <div className="feature-top">
              <div className="feature-icon-circle">
                <ImageIcon size={20} />
              </div>
              <span className="badge badge-emerald">IMAGE VAULT</span>
            </div>
            <h3 className="feature-title">Steganography Injection</h3>
            <ul className="feature-points-list">
              <li>LSB pixel encoding conceals payload inside PNGs</li>
              <li>Bypasses deep packet inspection filters</li>
              <li>Direct extraction with master password</li>
            </ul>
          </div>

          <div className="feature-box">
            <div className="feature-top">
              <div className="feature-icon-circle">
                <Flame size={20} />
              </div>
              <span className="badge badge-amber">AUTO-PURGE</span>
            </div>
            <h3 className="feature-title">Burn-on-Read &amp; Expiry</h3>
            <ul className="feature-points-list">
              <li>Instant cryptographic wipe upon first download</li>
              <li>Configurable TTL auto-expiration (15–60 mins)</li>
              <li>Automated worker removes expired blobs</li>
            </ul>
          </div>

          <div className="feature-box">
            <div className="feature-top">
              <div className="feature-icon-circle">
                <Radio size={20} />
              </div>
              <span className="badge badge-slate">DIRECT P2P</span>
            </div>
            <h3 className="feature-title">WebRTC Peer Streaming</h3>
            <ul className="feature-points-list">
              <li>Device-to-device direct connection</li>
              <li>Zero server intermediate storage</li>
              <li>Ideal for multi-gigabyte files and media</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
