import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Upload, Download, BookOpen, Sun, Moon, Monitor, Settings } from 'lucide-react';
import brandLogo from '../../image/icons.png';

/**
 * App Navbar Component
 * Primary Responsibility: Top navigation header with brand logo, route links, backend status indicator, theme toggle, and settings trigger.
 */
export const Navbar = memo(function Navbar({
  serverOnline,
  theme,
  resolvedTheme,
  onCycleTheme,
  onOpenSettings,
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

          {onOpenSettings && (
            <button
              className="settings-toggle-btn"
              onClick={onOpenSettings}
              aria-label="Open Settings & Privacy"
              title="Settings & Privacy"
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
});
