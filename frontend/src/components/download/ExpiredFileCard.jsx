import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Flame, ShieldAlert, RotateCcw, Home, Info, AlertTriangle } from 'lucide-react';

/**
 * ExpiredFileCard Component
 * Primary Responsibility: Display a friendly, non-technical explanation when a file is expired, burned, or download limit reached.
 */
export function ExpiredFileCard({
  reason = 'expired',
  customMessage,
  onNewSearch
}) {
  const navigate = useNavigate();

  const isBurn = reason === 'burned' || (customMessage && customMessage.toLowerCase().includes('burn'));
  const isLimit = reason === 'limit_reached' || (customMessage && customMessage.toLowerCase().includes('limit'));

  let title = 'File Expired';
  let badgeText = 'Expired';
  let badgeClass = 'badge-slate';
  let Icon = Clock;
  let primaryExplanation = 'This file is no longer available.';
  let secondaryExplanation = 'The sharing time limit has expired and the file was automatically deleted from the server.';

  if (isBurn) {
    title = 'File Self-Destructed';
    badgeText = 'Burned';
    badgeClass = 'badge-amber';
    Icon = Flame;
    primaryExplanation = 'This file was protected with Burn After Read and is no longer available.';
    secondaryExplanation = 'The file was permanently deleted from the server immediately after the download was completed.';
  } else if (isLimit) {
    title = 'Download Limit Reached';
    badgeText = 'Limit Reached';
    badgeClass = 'badge-amber';
    Icon = ShieldAlert;
    primaryExplanation = 'The download limit has been reached. This file is no longer available.';
    secondaryExplanation = 'This transfer reached its maximum allowed number of successful downloads and was purged from storage.';
  }

  return (
    <div className="expired-card animate-in" role="region" aria-label="Expired Transfer Notice">
      <div className="expired-card-header">
        <div className={`expired-card-icon ${isBurn ? 'expired-card-icon--burn' : ''}`}>
          <Icon size={28} />
        </div>
        <div className="expired-card-title-group">
          <div className="expired-card-badge-row">
            <h3 className="expired-card-title">{title}</h3>
            <span className={`badge ${badgeClass}`}>{badgeText}</span>
          </div>
          <p className="expired-card-primary-msg">
            {customMessage || primaryExplanation}
          </p>
        </div>
      </div>

      <div className="expired-card-body">
        <div className="expired-info-box">
          <Info size={16} className="expired-info-icon" />
          <p className="expired-info-text">
            {secondaryExplanation} Zero-knowledge security ensures expired files cannot be recovered or accessed through old links or QR codes.
          </p>
        </div>

        <div className="expired-card-actions">
          {onNewSearch && (
            <button
              className="btn btn-primary btn-md"
              onClick={onNewSearch}
              aria-label="Receive another file"
            >
              <RotateCcw size={15} /> Receive Another File
            </button>
          )}
          <button
            className="btn btn-secondary btn-md"
            onClick={() => navigate('/')}
            aria-label="Back to home"
          >
            <Home size={15} /> Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
