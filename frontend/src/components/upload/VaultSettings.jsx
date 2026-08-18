import React from 'react';
import { Flame, Image as ImageIcon, Radio, Users, Clock, HelpCircle } from 'lucide-react';

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
  return (
    <div className="vault-settings">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h4 className="settings-heading" style={{ marginBottom: 0 }}>
          Sharing &amp; Privacy Options
        </h4>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onOpenGuide}
          style={{ fontSize: '0.775rem', gap: 4 }}
        >
          <HelpCircle size={14} /> Feature Guide
        </button>
      </div>

      {/* Option 1: Burn-on-Read */}
      <div
        className={`vault-option-card ${burnOnRead ? 'active' : ''}`}
        onClick={() => !isTransferring && onBurnToggle()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && onBurnToggle()}
      >
        <div className="option-card__content">
          <div className="option-card__copy">
            <div className="option-card__icon option-card__icon--danger">
              <Flame size={18} />
            </div>
            <div>
              <div className="option-card__title-row">
                <strong className="option-card__title">Burn-on-Read (Self-Destruct)</strong>
                <span className="badge badge-amber">ONE-TIME USE</span>
              </div>
              <span className="option-card__description">
                Permanently deletes payload from the server immediately after the first recipient downloads.
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
            aria-label="Burn on read"
          />
        </div>
      </div>

      {/* Option 2: Image Steganography */}
      <div
        className={`vault-option-card ${useSteganography ? 'active' : ''}`}
        onClick={() => !isTransferring && setUseSteganography(!useSteganography)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && setUseSteganography(!useSteganography)}
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
      >
        <div className="option-card__content">
          <div className="option-card__copy">
            <div className="option-card__icon option-card__icon--primary">
              <Radio size={18} />
            </div>
            <div>
              <div className="option-card__title-row">
                <strong className="option-card__title">Direct P2P Transfer (WebRTC)</strong>
                <span className="badge badge-primary">FAST STREAM &gt;500MB</span>
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

      {/* Download limit selection */}
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
        >
          <option value={0}>Unlimited (until expiry)</option>
          <option value={1}>1 download (Burn-on-Read)</option>
          <option value={5}>5 downloads</option>
          <option value={10}>10 downloads (Standard)</option>
          <option value={20}>20 downloads</option>
          <option value={50}>50 downloads</option>
          <option value={100}>100 downloads</option>
        </select>
      </div>

      {/* Expiry selection */}
      <div className="expiry-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} className="field-icon" />
          <label htmlFor="expiry-select">Code Expiry (TTL)</label>
        </div>
        <select
          id="expiry-select"
          value={expiryHours}
          disabled={isTransferring}
          onChange={(e) => setExpiryHours(Number(e.target.value))}
        >
          <option value={0.25}>15 minutes</option>
          <option value={0.5}>30 minutes</option>
          <option value={0.75}>45 minutes</option>
          <option value={1}>60 minutes (Max)</option>
        </select>
      </div>
    </div>
  );
}
