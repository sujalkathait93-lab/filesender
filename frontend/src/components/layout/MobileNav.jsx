import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Upload, Download, BookOpen, Settings } from 'lucide-react';

/**
 * Mobile Bottom Navigation Component
 * Primary Responsibility: Bottom navigation bar for mobile and touch screens.
 */
export const MobileNav = memo(function MobileNav({
  currentPath,
  currentHash,
  onScrollToSection,
  onOpenSettings
}) {
  const navLinkClass = (path) => currentPath === path && !currentHash ? 'active' : '';

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <Link to="/" className={`mobile-nav-item ${navLinkClass('/')}`} aria-label="Home page">
        <Zap size={20} />
        <span>Home</span>
      </Link>
      <Link to="/upload" className={`mobile-nav-item ${navLinkClass('/upload')}`} aria-label="Send files page">
        <Upload size={20} />
        <span>Send</span>
      </Link>
      <Link to="/download" className={`mobile-nav-item ${navLinkClass('/download')}`} aria-label="Receive files page">
        <Download size={20} />
        <span>Receive</span>
      </Link>
      <Link
        to="/#how-to-use"
        onClick={(e) => onScrollToSection(e, 'how-to-use')}
        className={`mobile-nav-item ${currentHash === '#how-to-use' ? 'active' : ''}`}
        aria-label="User guide"
      >
        <BookOpen size={20} />
        <span>Guide</span>
      </Link>
      {onOpenSettings && (
        <button
          type="button"
          className="mobile-nav-item mobile-nav-btn"
          onClick={onOpenSettings}
          aria-label="Settings and Privacy"
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      )}
    </nav>
  );
});
