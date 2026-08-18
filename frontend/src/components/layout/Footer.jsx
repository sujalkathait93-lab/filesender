import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Upload, Download, BookOpen, Layers, HelpCircle } from 'lucide-react';
import brandLogo from '../../image/icons.png';

/**
 * App Footer Component
 * Primary Responsibility: Display footer brand, slogan, and sitemap anchor navigation links.
 */
export const Footer = memo(function Footer({ onScrollToSection }) {
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
