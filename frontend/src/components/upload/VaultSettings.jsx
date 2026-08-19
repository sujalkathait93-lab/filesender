import React, { useState } from 'react';
import { Flame, Image as ImageIcon, Radio, Users, Clock, HelpCircle, ChevronDown, ChevronUp, Info, Check } from 'lucide-react';

/**
 * VaultSettings Component
 * Primary Responsibility: Handle security & privacy toggles: Burn-on-Read, Steganography, Direct P2P, Download limits, and TTL expiry.
 */
export function VaultSettings({
  burnOnRead,
  onBurnToggle,
  useSteganography,
  setUseSteganography,
  useP2P,
  setUseP2P,
  maxDownloads,
  onMaxDownloadsChange,
  expiryHours,
  setExpiryHours,
  isTransferring,
  onOpenGuide
}) {
  const [showBurnDetails, setShowBurnDetails] = useState(false);

  return (
    <div className="vault-settings">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 className="settings-heading" style={{ marginBottom: 0 }}>
          Sharing &amp; Privacy Options
        </h4>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onOpenGuide}
          style={{ fontSize: '0.775rem', gap: 4 }}
          aria-label="Open feature guide"
        >
          <HelpCircle size={14} /> Feature Guide
        </button>
      </div>

      {/* Option 1: Burn-on-Read (Point-Wise Explanation) */}
      <div
        className={`vault-option-card ${burnOnRead ? 'active' : ''}`}
        onClick={() => !isTransferring && onBurnToggle()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && onBurnToggle()}
        aria-expanded={burnOnRead}
      >
        <div className="option-card__content">
          <div className="option-card__copy">
            <div className="option-card__icon option-card__icon--danger">
              <Flame size={18} />
            </div>
            <div>
              <div className="option-card__title-row">
                <strong className="option-card__title">Burn After Read (Self-Destruct)</strong>
                <span className="badge badge-amber">1 DOWNLOAD</span>
              </div>
              <span className="option-card__description">
                File becomes unavailable and permanently deleted after 1 successful download.
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={burnOnRead}
            disabled={isTransferring}
            onChange={(e) => {
              e.stopPropagation();
              onBurnToggle();
            }}
            className="option-checkbox"
            aria-label="Burn after read"
          />
        </div>

        {/* Expandable Explanation for Burn After Read */}
        <div className="vault-option-helper" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="vault-helper-toggle"
            onClick={() => setShowBurnDetails(!showBurnDetails)}
            aria-expanded={showBurnDetails}
          >
            <Info size={13} />
            <span>How Burn After Read works</span>
            {showBurnDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showBurnDetails && (
            <div className="vault-helper-pane animate-in">
              <div className="point-wise-guide">
                <div className="guide-point">
                  <strong>What is it?</strong>
                  <p>File becomes unavailable and permanently purged from server memory after the selected number of successful downloads.</p>
                </div>
                <div className="guide-point">
                  <strong>Why use it?</strong>
                  <p>Prevents continued access after the intended recipient downloads.</p>
                </div>
                <div className="guide-point">
                  <strong>Important:</strong>
                  <p>Only successful, 100% completed downloads reduce the count. Incomplete or preview downloads never burn the file.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Option 2: Image Steganography */}
      <div
        className={`vault-option-card ${useSteganography ? 'active' : ''}`}
        onClick={() => !isTransferring && setUseSteganography(!useSteganography)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && setUseSteganography(!useSteganography)}
        aria-expanded={useSteganography}
      >
        <div className="option-card__content">
          <div className="option-card__copy">
            <div className="option-card__icon option-card__icon--success">
              <ImageIcon size={18} />
            </div>
            <div>
              <div className="option-card__title-row">
                <strong className="option-card__title">Steganography Image Vault</strong>
                <span className="badge badge-emerald">STEALTH &lt;10MB</span>
              </div>
              <span className="option-card__description">
                Conceals encrypted payload bytes inside standard PNG pixels to bypass inspection filters.
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={useSteganography}
            disabled={isTransferring}
            onChange={(e) => {
              e.stopPropagation();
              setUseSteganography(e.target.checked);
            }}
            className="option-checkbox"
            aria-label="Steganography mode"
          />
        </div>
      </div>

      {/* Option 3: Direct P2P */}
      <div
        className={`vault-option-card ${useP2P ? 'active' : ''}`}
        onClick={() => !isTransferring && setUseP2P(!useP2P)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && setUseP2P(!useP2P)}
        aria-expanded={useP2P}
      >
        <div className="option-card__content">
          <div className="option-card__copy">
            <div className="option-card__icon option-card__icon--primary">
              <Radio size={18} />
            </div>
            <div>
              <div className="option-card__title-row">
                <strong className="option-card__title">Direct P2P Transfer (WebRTC)</strong>
                <span className="badge badge-primary">ZERO SERVER DISK</span>
              </div>
              <span className="option-card__description">
                Streams directly peer-to-peer between devices without storing files on intermediary servers.
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={useP2P}
            disabled={isTransferring}
            onChange={(e) => {
              e.stopPropagation();
              setUseP2P(e.target.checked);
            }}
            className="option-checkbox"
            aria-label="Direct P2P transfer"
          />
        </div>
      </div>

      {/* Download limit selection (1, 5, 10, 30, 60, 100, Unlimited) */}
      <div className="expiry-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} className="field-icon" />
          <label htmlFor="downloads-select">Download Limit</label>
        </div>
        <select
          id="downloads-select"
          value={maxDownloads}
          disabled={isTransferring}
          onChange={(e) => onMaxDownloadsChange(e.target.value)}
          aria-label="Select maximum download limit"
        >
          <option value={1}>1 download (Burn on read)</option>
          <option value={5}>5 downloads</option>
          <option value={10}>10 downloads (Standard)</option>
          <option value={30}>30 downloads</option>
          <option value={60}>60 downloads</option>
          <option value={100}>100 downloads</option>
          <option value={0}>Unlimited (until expiry)</option>
        </select>
      </div>

      {/* Expiry Countdown selection (15, 30, 45, 60 seconds) */}
      <div className="expiry-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} className="field-icon" />
          <label htmlFor="expiry-select">Expiry Countdown</label>
        </div>
        <select
          id="expiry-select"
          value={expiryHours}
          disabled={isTransferring}
          onChange={(e) => setExpiryHours(Number(e.target.value))}
          aria-label="Select code expiration time in seconds"
        >
          <option value={15}>15 seconds</option>
          <option value={30}>30 seconds</option>
          <option value={45}>45 seconds</option>
          <option value={60}>60 seconds (Standard)</option>
        </select>
      </div>
    </div>
  );
}
