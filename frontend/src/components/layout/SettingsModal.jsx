import React, { useState, useEffect } from 'react';
import {
  Settings, X, Sun, Moon, Monitor, ShieldCheck, Database,
  HardDrive, Info, Activity, Trash2, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DATA_STORAGE_POLICY } from '../../data/guideData';
import { purgeAllUserStorage } from '../../services/cookieCleanup';
import { clearAllTransferHistory } from '../../services/transferHistory';

/**
 * SettingsModal Component
 * Primary Responsibility: Global settings dialog for Theme (Light/Dark/System),
 * Data Storage & Privacy transparency, Cookie & Session purging, and System Diagnostics.
 */
export function SettingsModal({ isOpen, onClose, serverOnline, ephemeralStorage }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('theme'); // 'theme' | 'storage' | 'privacy' | 'diagnostics'
  const [purgeStatus, setPurgeStatus] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePurgeAllData = () => {
    const confirmPurge = window.confirm(
      'Are you sure you want to delete all cookies, session storage, decrypted cache, and transfer history from this browser?'
    );
    if (!confirmPurge) return;

    const res = purgeAllUserStorage();
    clearAllTransferHistory();
    setPurgeStatus(res.message || 'All cookies and session storage have been successfully cleared.');
    setTimeout(() => {
      setPurgeStatus(null);
    }, 4000);
  };

  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Settings & Privacy">
      <div className="preview-modal settings-modal animate-in">
        <div className="preview-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={18} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Settings &amp; Privacy</h3>
          </div>
          <button className="preview-close" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tabs-bar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'theme'}
            className={`settings-tab-btn ${activeTab === 'theme' ? 'active' : ''}`}
            onClick={() => setActiveTab('theme')}
          >
            <Sun size={15} /> Theme
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'storage'}
            className={`settings-tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            <Database size={15} /> Storage Architecture
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'privacy'}
            className={`settings-tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <Trash2 size={15} /> Cookies &amp; Data Purge
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'diagnostics'}
            className={`settings-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnostics')}
          >
            <Activity size={15} /> Diagnostics
          </button>
        </div>

        <div className="settings-body">
          {/* TAB 1: THEME SELECTOR */}
          {activeTab === 'theme' && (
            <div className="settings-section animate-in">
              <h4 className="settings-subheading">Appearance Theme</h4>
              <p className="settings-subtext">
                Choose how FileShare looks on your device. High-contrast, WCAG AA compliant colors.
              </p>

              <div className="theme-options-grid">
                <button
                  type="button"
                  className={`theme-option-card ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <div className="theme-option-icon">
                    <Sun size={20} />
                  </div>
                  <strong>Light Mode</strong>
                  <span>Crisp daylight background</span>
                </button>

                <button
                  type="button"
                  className={`theme-option-card ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <div className="theme-option-icon">
                    <Moon size={20} />
                  </div>
                  <strong>Dark Mode</strong>
                  <span>Sleek low-light contrast</span>
                </button>

                <button
                  type="button"
                  className={`theme-option-card ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => setTheme('system')}
                >
                  <div className="theme-option-icon">
                    <Monitor size={20} />
                  </div>
                  <strong>System Preference</strong>
                  <span>Auto-matches your device ({resolvedTheme})</span>
                </button>
              </div>

              <div className="settings-info-card">
                <Info size={16} />
                <span>
                  Theme preference is saved locally on your device and updates automatically when switching system dark mode.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: STORAGE ARCHITECTURE */}
          {activeTab === 'storage' && (
            <div className="settings-section animate-in">
              <h4 className="settings-subheading">Data Storage &amp; Separation Policy</h4>
              <p className="settings-subtext">
                FileShare strictly separates metadata, temporary encrypted blobs, and device cache.
              </p>

              <div className="storage-cards-list">
                {DATA_STORAGE_POLICY.sections.map((sec, idx) => (
                  <div key={idx} className="storage-policy-card">
                    <div className="storage-policy-header">
                      <strong>{sec.category}</strong>
                      <span className="badge badge-slate">{sec.storageLocation}</span>
                    </div>
                    <ul className="storage-policy-points">
                      {sec.whatStored.map((pt, pIdx) => (
                        <li key={pIdx}>• {pt}</li>
                      ))}
                    </ul>
                    <div className="storage-retention-tag">
                      <span className="retention-label">Retention:</span>
                      <span className="retention-text">{sec.retention}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: COOKIES & DATA PURGE */}
          {activeTab === 'privacy' && (
            <div className="settings-section animate-in">
              <h4 className="settings-subheading">Cookies &amp; Local Storage Purge</h4>
              <p className="settings-subtext">
                FileShare does not use tracking cookies. All session data, owner tokens, and decrypted memory buffers can be purged at any time.
              </p>

              <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ShieldCheck size={20} style={{ color: 'var(--success-fg)' }} />
                  <strong style={{ color: 'var(--fg-default)' }}>Zero-Knowledge Privacy Standard</strong>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.4, margin: 0 }}>
                  Decryption keys are never transmitted to the server. When files expire or self-destruct, all server blobs are erased permanently.
                </p>
              </div>

              {purgeStatus && (
                <div className="status-message success animate-in" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={16} />
                  <span>{purgeStatus}</span>
                </div>
              )}

              <button
                type="button"
                className="btn btn-danger btn-md"
                onClick={handlePurgeAllData}
                style={{ width: '100%' }}
              >
                <Trash2 size={16} /> Clear All Cookies &amp; Session Data Now
              </button>
            </div>
          )}

          {/* TAB 4: SYSTEM DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="settings-section animate-in">
              <h4 className="settings-subheading">System &amp; Connection Diagnostics</h4>
              <p className="settings-subtext">
                Live connection status to backend endpoints and WebRTC signaling.
              </p>

              <div className="diagnostics-list">
                <div className="diagnostic-item">
                  <span className="diagnostic-label">Backend Server:</span>
                  <span className={`diagnostic-value ${serverOnline ? 'text-success' : 'text-danger'}`}>
                    {serverOnline ? '● Connected (Healthy)' : '○ Offline'}
                  </span>
                </div>

                <div className="diagnostic-item">
                  <span className="diagnostic-label">Server Storage Engine:</span>
                  <span className="diagnostic-value">
                    {ephemeralStorage ? 'Ephemeral Serverless Disk' : 'Persistent Storage (/uploads)'}
                  </span>
                </div>

                <div className="diagnostic-item">
                  <span className="diagnostic-label">WebRTC Peer Signaling:</span>
                  <span className="diagnostic-value text-success">
                    ● Ready (STUN: stun.l.google.com:19302)
                  </span>
                </div>

                <div className="diagnostic-item">
                  <span className="diagnostic-label">Client Cryptography:</span>
                  <span className="diagnostic-value text-success">
                    ● Web Crypto API (AES-256-GCM + PBKDF2)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="preview-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
