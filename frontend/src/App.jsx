import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { PageSkeletonLoader } from './components/Skeletons';
import { HowToUseSection } from './components/HowToUseSection';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { HeroSection } from './components/home/HeroSection';
import { useTheme } from './context/ThemeContext';
import { api } from './services/api';
import './App.css';

// Only load Vercel analytics when deployed on Vercel
const SpeedInsights = import.meta.env.VITE_VERCEL_ANALYTICS
  ? lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })))
  : () => null;

// Route-level code splitting
const UploadPage = lazy(() => import('./pages/Upload'));
const DownloadPage = lazy(() => import('./pages/Download'));

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

      <Navbar
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

      <MobileNav
        currentPath={location.pathname}
        currentHash={location.hash}
        onScrollToSection={scrollToSection}
      />

      <Footer onScrollToSection={scrollToSection} />
    </div>
  );
}

export default App;
