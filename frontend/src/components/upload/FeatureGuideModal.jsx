import React, { useEffect } from 'react';
import { HelpCircle, X, Sparkles, Flame, Image as ImageIcon, Radio } from 'lucide-react';

/**
 * FeatureGuideModal Component
 * Primary Responsibility: Display explanatory modal guide for file privacy and transfer features.
 */
export function FeatureGuideModal({ isOpen, onClose }) {
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
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Feature & Privacy Guide">
      <div className="preview-modal">
        <div className="preview-header">
          <h3><HelpCircle size={18} /> Feature &amp; Privacy Guide</h3>
          <button className="preview-close" onClick={onClose} aria-label="Close guide">
            <X size={18} />
          </button>
        </div>
        <div className="preview-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>Smart Transfer Optimization</strong>
              <span className="badge badge-primary">Automatic</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
              <strong>How it works:</strong> Automatically assigns optimal chunk size, buffer depth, and in-flight parallelism based on file size, so you never have to configure technical transfer settings manually.
            </p>
          </div>

          <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Flame size={18} style={{ color: 'var(--warning-fg)' }} />
              <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>Burn-on-Read (Self-Destruct)</strong>
              <span className="badge badge-amber">One-Time</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
              <strong>How it works:</strong> The moment the recipient finishes downloading, the file is automatically and permanently purged from the server memory and disk.
            </p>
          </div>

          <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ImageIcon size={18} style={{ color: 'var(--success-fg)' }} />
              <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>Steganography Image Vault</strong>
              <span className="badge badge-emerald">&lt;10 MB</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
              <strong>How it works:</strong> Injects encrypted file bytes into the least-significant bits (LSB) of innocent-looking PNG image pixels to bypass strict network DPI firewalls.
            </p>
          </div>

          <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Radio size={18} style={{ color: 'var(--accent)' }} />
              <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>Direct P2P Transfer (WebRTC)</strong>
              <span className="badge badge-primary">&gt;500 MB</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
              <strong>How it works:</strong> Establishes a direct peer-to-peer browser data channel between sender and recipient without intermediate server storage.
            </p>
          </div>
        </div>
        <div className="preview-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
