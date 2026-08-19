import React, { useState, useEffect } from 'react';
import {
  Settings, X, Sun, Moon, Monitor, ShieldCheck, Database,
  HardDrive, Server, RefreshCw, CheckCircle2, AlertCircle, Info, Lock
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { DATA_STORAGE_POLICY } from '../../data/guideData';

/**
 * SettingsModal Component
 * Primary Responsibility: Manage theme preferences, inspect data storage & privacy transparency, and view system diagnostics.
 */
export function SettingsModal({ isOpen, onClose, serverOnline, ephemeralStorage }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('appearance'); // 'appearance' | 'storage' | 'network'

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Settings & Privacy">
      <div className="preview-modal settings-modal animate-in">
        <div className="preview-header">
          <h3><Settings size={18} /> Settings &amp; Privacy</h3>
          <button className="preview-close" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="settings-tabs-bar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'appearance'}
            className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Sun size={15} /> Appearance
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'storage'}
            className={`settings-tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            <Database size={15} /> Data &amp; Storage
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'network'}
            className={`settings-tab-btn ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            <Server size={15} /> Diagnostics
          </button>
        </div>

        <div className="settings-body">
          {/* TAB 1: APPEARANCE / THEME */}
          {activeTab === 'appearance' && (
            <div className="settings-section animate-in">
              <h4 className="settings-subheading">Theme Preference</h4>
              <p className="settings-subtext">
                Select your preferred color scheme. The application automatically adapts to system dark and light modes.
              </p>

              <div className="theme-options-grid">
                <button
                  className={`theme-option-card ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <div className="theme-option-icon">
                    <Sun size={20} />
                  </div>
                  <strong>Light Mode</strong>
                  <span>Crisp daylight contrast</span>
                </button>

                <button
                  className={`theme-option-card ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <div className="theme-option-icon">
                    <Moon size={20} />
                  </div>
                  <strong>Dark Mode</strong>
                  <span>Comfortable low-glare slate</span>
                </button>

                <button
                  className={`theme-option-card ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => setTheme('system')}
                  aria-pressed={theme === 'system'}
                >
                  <div className="theme-option-icon">
                    <Monitor size={20} />
                  </div>
                  <strong>System Mode</strong>
                  <span>Matches device OS ({resolvedTheme})</span>
                </button>
              </div>

              <div className="settings-info-card">
                <Info size={16} />
                <span>
                  <strong>Brightness Comfort:</strong> FileShare respects device brightness settings and avoids flashing elements or forced overrides.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: DATA STORAGE & PRIVACY */}
          {activeTab === 'storage' && (
            <div className="settings-section animate-in">
              <h4 className="settings-subheading">Data Storage &amp; Privacy Architecture</h4>
              <p className="settings-subtext">
                Strict separation of metadata, temporary ciphertext, and client memory.
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
                      <span className="retention-label">Retention &amp; Deletion:</span>
                      <span className="retention-text">{sec.retention}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="settings-info-card settings-info-card--success">
                <Lock size={16} />
                <span>
                  <strong>Zero Server Keys:</strong> Your encryption key remains isolated in your browser address bar (#key) and is never transmitted or logged.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: NETWORK & DIAGNOSTICS */}
          {activeTab === 'network' && (
            <div className="settings-section animate-in">
              <h4 className="settings-subheading">System Diagnostics</h4>
              <p className="settings-subtext">
                Real-time connection and storage engine verification.
              </p>

              <div className="diagnostics-list">
                <div className="diagnostic-item">
                  <span className="diagnostic-label">Backend Server Connection</span>
                  <span className={`diagnostic-value ${serverOnline ? 'text-success' : 'text-danger'}`}>
                    {serverOnline ? '● Connected & Operational' : '○ Offline / Connecting'}
                  </span>
                </div>

                <div className="diagnostic-item">
                  <span className="diagnostic-label">Storage Engine</span>
                  <span className="diagnostic-value">
                    {ephemeralStorage ? 'Temporary Ephemeral Storage (Serverless)' : 'Persistent Encrypted Disk'}
                  </span>
                </div>

                <div className="diagnostic-item">
                  <span className="diagnostic-label">Encryption Standard</span>
                  <span className="diagnostic-value">AES-256-GCM (Hardware Accelerated)</span>
                </div>

                <div className="diagnostic-item">
                  <span className="diagnostic-label">WebRTC Signaling &amp; P2P</span>
                  <span className="diagnostic-value">STUN / TURN Relay Enabled</span>
                </div>

                <div className="diagnostic-item">
                  <span className="diagnostic-label">Maximum Total Transfer Size</span>
                  <span className="diagnostic-value">1 GB</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="preview-footer">
          <button className="btn btn-primary btn-md" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
