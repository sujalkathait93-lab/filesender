import React from 'react';
import { AlertTriangle, RefreshCw, Info, CheckCircle2, Shield, Lock } from 'lucide-react';

/**
 * Clean Empty State with Action Button
 */
export function EmptyState({ icon: Icon = Info, title, description, actionText, onAction }) {
  return (
    <div className="empty-state-card animate-in" role="region" aria-label={title}>
      <div className="empty-state-icon">
        <Icon size={32} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {actionText && onAction && (
        <button className="btn btn-secondary empty-state-btn" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}

/**
 * Error Alert with Retry Action
 */
export function ErrorAlert({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="status-message error animate-in" role="alert">
      <AlertTriangle size={20} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry && (
        <button
          className="btn btn-secondary error-retry-btn"
          onClick={onRetry}
          title="Retry operation"
          aria-label="Retry operation"
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

/**
 * Measurable Progress Bar with Stage Label, Speed & Percentage
 */
export function MeasurableProgressBar({ stage = 'Processing', percent = 0, statusMessage = '' }) {
  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div
      className="progress-container"
      role="progressbar"
      aria-valuenow={clampedPercent}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label={statusMessage || `${stage}... ${clampedPercent}%`}
    >
      <div className="progress-bar">
        <div
          className="progress-fill green-fill"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <div className="progress-text">
        <span>{statusMessage || `${stage}...`}</span>
        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{clampedPercent}%</span>
      </div>
    </div>
  );
}
