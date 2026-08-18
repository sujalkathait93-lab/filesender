import React, { useState, useEffect, Suspense, lazy, useCallback, memo } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Upload, Download, Zap, AlertTriangle, ArrowRight,
  CheckCircle2, ShieldCheck, Sun, Moon, Monitor,
  HelpCircle, BookOpen, Layers
} from 'lucide-react'
import { PageSkeletonLoader } from './components/Skeletons'
import { HowToUseSection } from './components/HowToUseSection'
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

/**
 * Navbar Header subcomponent (SRP: Top header & theme/network controls)
 */
const AppNavbar = memo(function AppNavbar({
  serverOnline,
  theme,
  resolvedTheme,
  onCycleTheme,
  currentPath,
  currentHash,
  onScrollToSection
}) {
  const navLinkClass = (path) => currentPath === path && !currentHash ? 'active' : '';

  return (
    <nav className="navbar" aria-label="Main Navigation">
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
        <div className="nav-segmented" role="navigation" aria-label="Desktop Navigation">
          <Link to="/" className={`nav-segmented-link ${navLinkClass('/')}`}>
            <Zap size={15} /> Home
          </Link>
          <Link to="/upload" className={`nav-segmented-link ${navLinkClass('/upload')}`}>
            <Upload size={15} /> Send Files
          </Link>
          <Link to="/download" className={`nav-segmented-link ${navLinkClass('/download')}`}>
            <Download size={15} /> Receive Files
          </Link>
          <Link
            to="/#how-to-use"
            onClick={(e) => onScrollToSection(e, 'how-to-use')}
            className={`nav-segmented-link ${currentHash === '#how-to-use' ? 'active' : ''}`}
          >
            <BookOpen size={15} /> How to Use
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
            onClick={onCycleTheme}
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
  );
});

/**
 * Mobile Bottom Navigation (SRP: Touch navigation for mobile viewports)
 */
const MobileBottomNav = memo(function MobileBottomNav({ currentPath, currentHash, onScrollToSection }) {
  const navLinkClass = (path) => currentPath === path && !currentHash ? 'active' : '';

  return (
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
      <Link
        to="/#how-to-use"
        onClick={(e) => onScrollToSection(e, 'how-to-use')}
        className={`mobile-nav-item ${currentHash === '#how-to-use' ? 'active' : ''}`}
      >
        <BookOpen size={20} />
        <span>Guide</span>
      </Link>
    </nav>
  );
});

/**
 * App Footer (SRP: Footer brand and anchor navigation)
 */
const AppFooter = memo(function AppFooter({ onScrollToSection }) {
  return (
    <footer className="footer" aria-label="Footer">
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
          <Link to="/#how-to-use" onClick={(e) => onScrollToSection(e, 'how-to-use')}>
            <BookOpen size={14} /> How to Use
          </Link>
          <Link to="/#features" onClick={(e) => onScrollToSection(e, 'features')}>
            <Layers size={14} /> Features
          </Link>
          <Link to="/#faq" onClick={(e) => onScrollToSection(e, 'faq')}>
            <HelpCircle size={14} /> FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
});

/**
 * Hero Section (SRP: Landing hero header, value propositions, and CTA buttons)
 */
const HeroSection = memo(function HeroSection({ onScrollToSection }) {
  return (
    <section className="hero" aria-label="Hero">
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
        <a
          href="#how-to-use"
          onClick={(e) => onScrollToSection(e, 'how-to-use')}
          className="btn btn-outline btn-lg hero-guide-btn"
        >
          <BookOpen size={18} /> How to Use
        </a>
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
        <div className="highlight-item">
          <CheckCircle2 size={15} />
          <span>WebRTC P2P Direct</span>
        </div>
      </div>
    </section>
  );
});

/**
 * Home Page (SRP: Orchestrates Hero and HowToUse sections)
 */
function HomePage({ onScrollToSection }) {
  return (
    <div className="home-page animate-in">
      <HeroSection onScrollToSection={onScrollToSection} />
      <HowToUseSection />
    </div>
  );
}

/**
 * Main Application Root (SRP: Global routing, theme coordination, and health monitoring)
 */
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
    let isMounted = true;
    const checkServer = async () => {
      try {
        const health = await api.health();
        if (!isMounted) return;
        if (!health || health.status !== 'healthy') throw new Error('Health check failed');
        setServerOnline(true);
        setEphemeralStorage(health.persistent_storage === false);
      } catch (_) {
        if (isMounted) {
          setServerOnline(false);
          setEphemeralStorage(false);
        }
      }
    };
    checkServer();
    return () => {
      isMounted = false;
    };
  }, []);

  // Smooth anchor scrolling handler
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      const elem = document.getElementById(targetId);
      if (elem) {
        setTimeout(() => {
          elem.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location]);

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem('fileshare_banner_dismissed', '1');
    } catch (_) {}
  }, []);

  const handleCycleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      if (prevTheme === 'system') return 'light';
      if (prevTheme === 'light') return 'dark';
      return 'system';
    });
  }, [setTheme]);

  const scrollToSection = useCallback((e, sectionId) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const elem = document.getElementById(sectionId);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', `#${sectionId}`);
      }
    }
  }, [location.pathname]);

  return (
    <div className="app">
      <SpeedInsights />

      <AppNavbar
        serverOnline={serverOnline}
        theme={theme}
        resolvedTheme={resolvedTheme}
        onCycleTheme={handleCycleTheme}
        currentPath={location.pathname}
        currentHash={location.hash}
        onScrollToSection={scrollToSection}
      />

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
            <Route path="/" element={<HomePage onScrollToSection={scrollToSection} />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/download/:fileId?" element={<DownloadPage />} />
          </Routes>
        </Suspense>
      </main>

      <MobileBottomNav
        currentPath={location.pathname}
        currentHash={location.hash}
        onScrollToSection={scrollToSection}
      />

      <AppFooter onScrollToSection={scrollToSection} />
    </div>
  );
}

export default App;
