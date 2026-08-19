import React from 'react';
import {
  Shield, Check, Radio, Info, Flame, Key,
  RefreshCw, Copy, Upload, Trash2, CheckCircle2, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatBytes } from '../../utils/format';
import { formatExpiryLabel } from './TransferConfirmModal';

const MAX_REFRESHES = 5;

/**
 * ShareResultCard Component
 * Primary Responsibility: Display transfer completion state, transfer code, QR code with refresh, copy actions, and transfer cancellation.
 */
export function ShareResultCard({
  result,
  shareUrl,
  useP2P,
  p2pState,
  p2pStatus,
  stegoSkipped,
  expiryHours,
  copied,
  refreshCount,
  isRefreshingToken,
  refreshLimitReached,
  onRefreshQRToken,
  onCopyCode,
  onClearAll,
  onCancelTransfer
}) {
  if (!result) return null;

  const downloadStatusLabel = () => {
    if (result.isBurn || result.maxDownloads === 1) {
      return 'Active • 1 download remaining (Burn After Read)';
    }
    if (result.maxDownloads === 0) {
      return 'Unlimited (Active until expiry)';
    }
    return `Active • ${result.maxDownloads} downloads remaining`;
  };

  return (
    <div className="share-section animate-in" role="region" aria-label="Transfer Ready">
      <h3><Shield size={20} className="share-heading-icon" /> Transfer Encrypted &amp; Ready</h3>

      <div className="status-message success">
        <Check size={16} />
        <span>Files encrypted in your browser. Anyone with this code can download. Keep it safe!</span>
      </div>

      {useP2P && (
        <div className={`status-message ${p2pState === 'connected' ? 'success' : 'info'}`}>
          <Radio size={16} />
          <span>{p2pStatus || 'Direct P2P: waiting for peer connection… Cloud link still active.'}</span>
        </div>
      )}

      {stegoSkipped && (
        <div className="status-message info">
          <Info size={16} />
          <span>Payload exceeded image steganography limits (&gt;10 MB), encrypted directly with AES-256-GCM.</span>
        </div>
      )}

      <div className="file-meta">
        <div className="meta-item">
          <label>Files</label>
          <span>{result.fileCount} file{result.fileCount === 1 ? '' : 's'}</span>
        </div>
        <div className="meta-item">
          <label>Total Size</label>
          <span>{formatBytes(result.originalSize)}</span>
        </div>
        <div className="meta-item">
          <label>Download Limit</label>
          <span>
            {result.isBurn || result.maxDownloads === 1
              ? '1 (Burn After Read)'
              : result.maxDownloads === 0
              ? 'Unlimited'
              : `${result.maxDownloads} downloads`}
          </span>
        </div>
        <div className="meta-item">
          <label>Expires In</label>
          <span>{formatExpiryLabel(expiryHours)}</span>
        </div>
      </div>

      {/* Burn After Read Reassurance Banner */}
      {(result.isBurn || result.maxDownloads === 1) && (
        <div className="burn-banner">
          <Flame size={20} className="burn-icon" />
          <div>
            <strong className="burn-title">Burn After Read Active</strong>
            <span className="burn-copy">
              Permanently deleted from server immediately after 1 successful download.
            </span>
          </div>
        </div>
      )}

      <div className="crypto-code-box">
        <label className="crypto-code-label--success"><Key size={14} /> 10-Digit Transfer Code</label>
        <div className="crypto-code-text">{result.transferCode}</div>
      </div>

      {shareUrl && (
        <div className="qr-code-box animate-in">
          <div className="qr-heading">
            <strong className="qr-heading-title">
              <QrCode size={16} /> Scan QR Code to Download
            </strong>
            <span className="badge badge-primary">
              Tokens: {refreshCount}/{MAX_REFRESHES}
            </span>
          </div>

          <div className="qr-code-wrapper">
            <QRCodeSVG value={shareUrl} size={160} level="M" includeMargin={false} />
          </div>

          <div>
            {!refreshLimitReached && (
              <button
                onClick={onRefreshQRToken}
                disabled={isRefreshingToken}
                className="btn btn-secondary btn-sm refresh-button"
                aria-label="Refresh QR token"
              >
                <RefreshCw size={13} className={isRefreshingToken ? 'spin' : ''} /> Refresh QR Token
              </button>
            )}

            {refreshLimitReached && (
              <div className="limit-error">
                QR token refresh limit reached (5/5).
              </div>
            )}
          </div>
        </div>
      )}

      <div className="share-actions">
        <button
          className="btn btn-primary btn-lg full-width"
          onClick={onCopyCode}
          aria-label="Copy transfer code to clipboard"
        >
          {copied ? (
            <>
              <Check size={18} /> Transfer Code Copied!
            </>
          ) : (
            <>
              <Copy size={18} /> Copy Code
            </>
          )}
        </button>
      </div>

      <div className="share-bottom-actions">
        <button
          className="btn btn-secondary button-block"
          onClick={onClearAll}
          aria-label="Send another file"
        >
          <Upload size={15} /> Send Another File
        </button>

        {result.ownerToken && (
          <button
            onClick={onCancelTransfer}
            className="btn btn-secondary button-block button-block-danger"
            aria-label="Cancel and delete this transfer"
          >
            <Trash2 size={15} /> Cancel Transfer
          </button>
        )}
      </div>
    </div>
  );
}
