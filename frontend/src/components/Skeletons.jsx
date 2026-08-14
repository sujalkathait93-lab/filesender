import React from 'react';
import './Skeletons.css';

/**
 * Basic Shimmer Line / Block Component
 */
export function SkeletonBlock({ width = '100%', height = '1rem', borderRadius = '6px', style = {} }) {
  return (
    <div
      className="skeleton-shimmer skeleton-block"
      style={{ width, height, borderRadius, ...style }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton Loader matching .file-info card exactly to prevent layout shifts (CLS)
 */
export function FileInfoSkeleton() {
  return (
    <div className="file-info file-info-skeleton animate-in" role="status" aria-label="Loading file information...">
      <div className="file-info-header">
        <div className="skeleton-shimmer skeleton-icon" />
        <div className="file-details" style={{ flex: 1 }}>
          <SkeletonBlock width="65%" height="1.1rem" style={{ marginBottom: '0.5rem' }} />
          <SkeletonBlock width="40%" height="0.85rem" />
        </div>
      </div>

      <div className="file-meta">
        <div className="meta-item">
          <SkeletonBlock width="50%" height="0.75rem" style={{ marginBottom: '0.4rem' }} />
          <SkeletonBlock width="70%" height="0.95rem" />
        </div>
        <div className="meta-item">
          <SkeletonBlock width="50%" height="0.75rem" style={{ marginBottom: '0.4rem' }} />
          <SkeletonBlock width="70%" height="0.95rem" />
        </div>
        <div className="meta-item">
          <SkeletonBlock width="50%" height="0.75rem" style={{ marginBottom: '0.4rem' }} />
          <SkeletonBlock width="70%" height="0.95rem" />
        </div>
      </div>

      <div className="action-row" style={{ marginTop: '1.25rem' }}>
        <SkeletonBlock width="45%" height="48px" borderRadius="12px" />
        <SkeletonBlock width="55%" height="48px" borderRadius="12px" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader matching selected multi-file list in Upload page
 */
export function FileListSkeleton({ count = 3 }) {
  return (
    <div className="selected-files-list file-list-skeleton" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="file-info-header"
          style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: '10px' }}
        >
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '8px', flexShrink: 0 }} />
          <div className="file-details" style={{ flex: 1, minWidth: 0, marginLeft: '0.75rem' }}>
            <SkeletonBlock width="60%" height="0.9rem" style={{ marginBottom: '0.35rem' }} />
            <SkeletonBlock width="35%" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for preview modal media (images, videos, PDFs)
 */
export function PreviewMediaSkeleton({ height = '300px' }) {
  return (
    <div className="preview-media-skeleton" style={{ height }} aria-hidden="true">
      <div className="skeleton-shimmer" style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
      <div className="preview-spinner-overlay">
        <div className="spinner" />
        <span>Loading media preview...</span>
      </div>
    </div>
  );
}

/**
 * Full page skeleton fallback for route-level Suspense loading
 */
export function PageSkeletonLoader() {
  return (
    <div className="page-container page-skeleton animate-in" role="status" aria-label="Loading page...">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <SkeletonBlock width="220px" height="2rem" style={{ margin: '0 auto 0.75rem auto' }} />
        <SkeletonBlock width="380px" height="1rem" style={{ margin: '0 auto' }} />
      </div>

      <div className="bento-grid" style={{ marginTop: '2rem' }}>
        <div className="bento-card bento-col-6">
          <SkeletonBlock width="40px" height="40px" borderRadius="10px" style={{ marginBottom: '1rem' }} />
          <SkeletonBlock width="45%" height="1.2rem" style={{ marginBottom: '0.75rem' }} />
          <SkeletonBlock width="90%" height="0.9rem" style={{ marginBottom: '0.4rem' }} />
          <SkeletonBlock width="75%" height="0.9rem" />
        </div>
        <div className="bento-card bento-col-6">
          <SkeletonBlock width="40px" height="40px" borderRadius="10px" style={{ marginBottom: '1rem' }} />
          <SkeletonBlock width="45%" height="1.2rem" style={{ marginBottom: '0.75rem' }} />
          <SkeletonBlock width="90%" height="0.9rem" style={{ marginBottom: '0.4rem' }} />
          <SkeletonBlock width="75%" height="0.9rem" />
        </div>
      </div>
    </div>
  );
}

/**
 * Indeterminate progress bar for non-measurable asynchronous operations
 */
export function IndeterminateProgressBar({ label = 'Processing...' }) {
  return (
    <div className="progress-container indeterminate-progress" role="progressbar" aria-label={label} aria-busy="true">
      <div className="progress-bar">
        <div className="progress-fill indeterminate-fill" />
      </div>
      <div className="progress-text">
        <span>{label}</span>
        <span className="pulse-text">Please wait...</span>
      </div>
    </div>
  );
}
