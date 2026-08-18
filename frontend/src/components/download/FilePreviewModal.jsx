import React, { useEffect } from 'react';
import { Eye, X, Download, ShieldCheck, Music } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { PreviewMediaSkeleton } from '../Skeletons';
import { FileCategoryIcon } from '../common/FileCategoryIcon';

/**
 * FilePreviewModal Component
 * Primary Responsibility: Render in-browser preview modal for decrypted files with media support, tab navigation, and save action.
 */
export function FilePreviewModal({
  isOpen,
  activePreviewItem,
  previewBundleFiles,
  activePreviewIndex,
  mediaLoading,
  setMediaLoading,
  onSelectPreviewFile,
  onClose,
  onDownloadAndClose
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !activePreviewItem) return null;

  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="File Preview">
      <div className="preview-modal">
        <div className="preview-header">
          <h3>
            <FileCategoryIcon category={activePreviewItem.category} size={20} />
            <span>Preview: {activePreviewItem.fileName}</span>
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-primary">
              <Eye size={12} /> In-Browser
            </span>
            <button className="preview-close" onClick={onClose} aria-label="Close preview">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Multi-file tab selector */}
        {previewBundleFiles.length > 1 && (
          <div className="preview-bundle-bar">
            {previewBundleFiles.map((f, i) => (
              <button
                key={i}
                className={`preview-bundle-tab ${i === activePreviewIndex ? 'active' : ''}`}
                onClick={() => onSelectPreviewFile(i)}
              >
                {f.name} ({formatBytes(f.size)})
              </button>
            ))}
          </div>
        )}

        <div className="preview-body">
          {/* Image Preview */}
          {activePreviewItem.category === 'image' && (
            <div className="preview-media">
              {mediaLoading && <PreviewMediaSkeleton height="260px" />}
              <img
                src={activePreviewItem.content}
                alt="Decrypted Preview"
                className={`preview-image ${mediaLoading ? 'is-hidden' : ''}`}
                onLoad={() => setMediaLoading(false)}
                onError={() => setMediaLoading(false)}
              />
            </div>
          )}

          {/* Video Preview */}
          {activePreviewItem.category === 'video' && (
            <div className="preview-media">
              {mediaLoading && <PreviewMediaSkeleton height="260px" />}
              <video
                src={activePreviewItem.content}
                controls
                autoPlay
                className={`preview-video ${mediaLoading ? 'is-hidden' : ''}`}
                playsInline
                onLoadedData={() => setMediaLoading(false)}
                onError={() => setMediaLoading(false)}
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}

          {/* Audio Preview */}
          {activePreviewItem.category === 'audio' && (
            <div className="preview-audio-wrapper">
              <Music size={40} className="preview-audio-icon" />
              <p className="preview-audio-name">{activePreviewItem.fileName}</p>
              <audio
                src={activePreviewItem.content}
                controls
                autoPlay
                className="preview-audio"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* PDF Preview */}
          {activePreviewItem.category === 'pdf' && (
            <div className="preview-pdf-wrapper">
              <iframe
                src={activePreviewItem.content}
                title="PDF Preview"
                className="preview-pdf"
              />
            </div>
          )}

          {/* Text / Code Preview */}
          {activePreviewItem.category === 'text' && (
            <pre className="preview-text">{activePreviewItem.content}</pre>
          )}

          {/* Unsupported binary / Archive / Document card */}
          {!activePreviewItem.canPreviewDirectly && (
            <div className="preview-unsupported-card">
              <div className="file-icon" style={{ margin: '0 auto 12px auto', width: 48, height: 48 }}>
                <FileCategoryIcon category={activePreviewItem.category} size={24} />
              </div>
              <h4>{activePreviewItem.fileName}</h4>
              <div style={{ margin: '8px 0' }}>
                <span className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                  {activePreviewItem.label || 'File'}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', maxWidth: 440, margin: '8px auto', lineHeight: 1.4 }}>
                {activePreviewItem.description || 'This file format cannot be rendered directly inside web browsers. Please download to open on your device.'}
              </p>
              <div style={{ marginTop: 12, padding: '6px 12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--fg-subtle)' }}>
                <ShieldCheck size={14} style={{ color: 'var(--success-fg)' }} />
                <span>Size: {formatBytes(activePreviewItem.fileSize)} &bull; Verified AES-256-GCM Decryption</span>
              </div>
            </div>
          )}
        </div>

        <div className="preview-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Done Viewing
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={onDownloadAndClose}
          >
            <Download size={14} /> Save &amp; Download
          </button>
        </div>
      </div>
    </div>
  );
}
