import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Download, ArrowRight, BookOpen, CheckCircle2, ShieldCheck } from 'lucide-react';

/**
 * Hero Section Component
 * Primary Responsibility: Landing hero header, security badge, headline value proposition, CTA buttons, and highlight chips.
 */
export const HeroSection = memo(function HeroSection({ onScrollToSection }) {
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
          <span>Up to 1 GB Transfer</span>
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
