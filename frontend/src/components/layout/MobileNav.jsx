import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Upload, Download, BookOpen } from 'lucide-react';

/**
 * Mobile Bottom Navigation Component
 * Primary Responsibility: Bottom navigation bar for mobile and touch screens.
 */
export const MobileNav = memo(function MobileNav({ currentPath, currentHash, onScrollToSection }) {
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
