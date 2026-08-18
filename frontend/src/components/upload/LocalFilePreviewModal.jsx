import React, { useEffect } from 'react';
import { Eye, X } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { detectFileType } from '../../utils/fileType';
import { FileCategoryIcon } from '../common/FileCategoryIcon';

/**
 * LocalFilePreviewModal Component
 * Primary Responsibility: Render local browser preview modal for sender files (images, video, audio, pdf, code, text, or unsupported fallback).
 */
export function LocalFilePreviewModal({
  previewFile,
  previewUrl,
  previewText,
  onClose
}) {
  useEffect(() => {
    if (!previewFile) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFile, onClose]);

  if (!previewFile) return null;

  const detection = detectFileType(previewFile.name, previewFile.type);

  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Local File Preview">
      <div className="preview-modal">
        <div className="preview-header">
          <h3><Eye size={18} /> Preview: {previewFile.name}</h3>
          <button className="preview-close" onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </button>
        </div>
        <div className="preview-body">
          {previewUrl && detection.category === 'image' && (
            <div className="local-preview-media">
              <img src={previewUrl} alt={previewFile.name} className="preview-image" />
            </div>
          )}
          {previewUrl && detection.category === 'video' && (
            <div className="local-preview-media">
              <video src={previewUrl} controls autoPlay playsInline className="preview-video" />
            </div>
          )}
          {previewUrl && detection.category === 'audio' && (
            <div className="preview-audio-wrapper">
              <audio src={previewUrl} controls autoPlay className="preview-audio" />
            </div>
          )}
          {previewUrl && detection.category === 'pdf' && (
            <div className="preview-pdf-wrapper">
              <iframe src={previewUrl} title="PDF Preview" className="preview-pdf" />
            </div>
          )}
          {previewText && (
            <pre className="preview-text">{previewText}</pre>
          )}
          {!previewUrl && !previewText && (
            <div className="preview-unsupported-card">
              <div className="file-icon" style={{ margin: '0 auto 12px auto', width: 44, height: 44 }}>
                <FileCategoryIcon fileName={previewFile.name} mimeType={previewFile.type} size={22} />
              </div>
              <h4>{previewFile.name}</h4>
              <div style={{ margin: '8px 0' }}>
                <span className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                  {detection.label}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', maxWidth: 440, margin: '8px auto' }}>
                {detection.description || 'This file cannot be rendered inside the web browser. The recipient will download and open it directly on their device.'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-subtle)', marginTop: 8 }}>
                Total Size: {formatBytes(previewFile.size)} • Memory Verified
              </p>
            </div>
          )}
        </div>
        <div className="preview-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
