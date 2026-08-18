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
export function ErrorAlert({ message, onRetry, actionText = 'Retry', onAction }) {
  if (!message) return null;
  const handler = onAction || onRetry;

  return (
    <div className="status-message error animate-in" role="alert">
      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>{message}</div>
      {handler && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={handler}
          title={actionText}
          aria-label={actionText}
          style={{ flexShrink: 0 }}
        >
          {actionText === 'Retry' && <RefreshCw size={13} />}
          {actionText}
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
          // The percentage is runtime data, so a CSS custom property is the
          // only inline value needed by this reusable progress component.
          style={{ '--progress-width': `${clampedPercent}%` }}
        />
      </div>
      <div className="progress-text">
        <span>{statusMessage || `${stage}...`}</span>
        <span className="progress-percent">{clampedPercent}%</span>
      </div>
    </div>
  );
}
