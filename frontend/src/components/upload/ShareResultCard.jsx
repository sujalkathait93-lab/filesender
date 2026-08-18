import React from 'react';
import {
  Shield, Check, Radio, Info, Flame, Key,
  RefreshCw, Copy, Upload, Trash2
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

  return (
    <div className="share-section animate-in">
      <h3><Shield size={20} className="share-heading-icon" /> Transfer Encrypted &amp; Ready</h3>

      <div className="status-message success">
        <Check size={16} />
        <span>Files encrypted and ready. Anyone with this code can download. Keep it safe!</span>
      </div>

      {useP2P && (
        <div className={`status-message ${p2pState === 'connected' ? 'success' : 'info'}`}>
          <Radio size={16} />
          <span>{p2pStatus || 'Direct P2P: waiting for peer… REST share still active.'}</span>
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
          <span>{result.fileCount} file(s)</span>
        </div>
        <div className="meta-item">
          <label>Total Size</label>
          <span>{formatBytes(result.originalSize)}</span>
        </div>
        <div className="meta-item">
          <label>Downloads</label>
          <span>
            {result.maxDownloads === 0
              ? 'Unlimited'
              : result.maxDownloads === 1
              ? '1 (Burn on read)'
              : `${result.maxDownloads} downloads`}
          </span>
        </div>
        <div className="meta-item">
          <label>Expires In</label>
          <span>{formatExpiryLabel(expiryHours)}</span>
        </div>
      </div>

      {result.isBurn && (
        <div className="burn-banner">
          <Flame size={20} className="burn-icon" />
          <div>
            <strong className="burn-title">Burn-on-Read Active</strong>
            <span className="burn-copy">
              Permanently deletes from server immediately after the recipient downloads.
            </span>
          </div>
        </div>
      )}

      <div className="crypto-code-box">
        <label className="crypto-code-label--success"><Key size={14} /> Transfer Code</label>
        <div className="crypto-code-text">{result.transferCode}</div>
      </div>

      {shareUrl && (
        <div className="qr-code-box animate-in">
          <div className="qr-heading">
            <strong className="qr-heading-title">Scan QR Code to Download</strong>
            <span className="badge badge-primary">
              Tokens: {refreshCount}/{MAX_REFRESHES}
            </span>
          </div>

          <div className="qr-code-wrapper">
            <QRCodeSVG value={shareUrl} size={150} level="M" includeMargin={false} />
          </div>

          <div>
            {!refreshLimitReached && (
              <button
                onClick={onRefreshQRToken}
                disabled={isRefreshingToken}
                className="btn btn-secondary btn-sm refresh-button"
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
        <button className="btn btn-primary btn-lg full-width" onClick={onCopyCode}>
          {copied ? (
            <>
              <Check size={18} /> Code Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy size={18} /> Copy Transfer Code
            </>
          )}
        </button>
      </div>

      <button className="btn btn-secondary button-block" onClick={onClearAll}>
        <Upload size={15} /> Send Another Transfer
      </button>
      {result.ownerToken && (
        <button
          onClick={onCancelTransfer}
          className="btn btn-secondary button-block button-block-danger"
        >
          <Trash2 size={15} /> Cancel &amp; Delete This Transfer
        </button>
      )}
    </div>
  );
}
