import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2, Copy, RefreshCw, Trash2, Plus, QrCode,
  Flame, Key, Clock, ShieldCheck, Share2, AlertTriangle, ArrowRight, ExternalLink
} from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { copyToClipboard } from '../../utils/clipboard';
import { createShareMessage } from '../../crypto';

const MAX_REFRESHES = 5;

/**
 * ShareResultCard Component
 * Primary Responsibility: Active Sender Dashboard Card rendered after successful upload.
 * Displays 10-digit Transfer Code, QR Code, live expiry countdown, download telemetry, and sender actions.
 */
export function ShareResultCard({
  result,
  shareUrl,
  copied,
  onCopy,
  onNewUpload,
  onCancel,
  isCancelling,
  onRefreshQRToken,
  isRefreshingToken,
  refreshCount,
  refreshLimitReached
}) {
  const [now, setNow] = useState(Date.now());
  const [copiedShareMsg, setCopiedShareMsg] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!result) return null;

  const isBurn = Boolean(result.burnOnRead) || result.maxDownloads === 1;
  const expiresTimestamp = result.expiresAt ? new Date(result.expiresAt).getTime() : 0;
  const remainingMillis = Math.max(0, expiresTimestamp - now);
  const totalSeconds = Math.floor(remainingMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isExpired = remainingMillis <= 0;

  const remainingDownloads = result.downloadsRemaining !== undefined
    ? result.downloadsRemaining
    : result.maxDownloads > 0
    ? Math.max(0, result.maxDownloads - (result.downloadCount || 0))
    : null;

  const getDownloadLimitText = () => {
    if (isBurn) return '1 download (Burn After Read)';
    if (result.maxDownloads === 0) return 'Unlimited downloads until expiry';
    return `${result.downloadCount || 0} of ${result.maxDownloads} downloads used (${remainingDownloads} remaining)`;
  };

  const handleShareMessage = async () => {
    const msg = createShareMessage({
      transferCode: result.transferCode,
      shareUrl,
      expiryHours: 1,
      fileCount: result.fileCount || 1,
      totalSize: formatBytes(result.originalSize)
    });
    const ok = await copyToClipboard(msg);
    if (ok) {
      setCopiedShareMsg(true);
      setTimeout(() => setCopiedShareMsg(false), 2500);
    }
  };

  const handleWhatsAppShare = () => {
    const msg = createShareMessage({
      transferCode: result.transferCode,
      shareUrl,
      expiryHours: 1,
      fileCount: result.fileCount || 1,
      totalSize: formatBytes(result.originalSize)
    });
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="upload-result animate-in" role="region" aria-label="Active Transfer Hub">
      {/* Success Confirmation Header */}
      <div className="result-header-banner">
        <div className="result-success-icon-wrap">
          <CheckCircle2 size={28} className="result-success-icon" />
        </div>
        <div className="result-header-text">
          <h3 className="result-title">Encrypted &amp; Ready to Share!</h3>
          <p className="result-subtitle">
            Your file was encrypted in your browser and is securely staged for transfer.
          </p>
        </div>
      </div>

      {/* Burn After Read Alert */}
      {isBurn && (
        <div className="burn-banner">
          <Flame size={20} className="burn-icon" />
          <div>
            <strong className="burn-title">Burn After Read Active</strong>
            <span className="burn-copy">
              Permanently deleted from server disk immediately after 1 successful download.
            </span>
          </div>
        </div>
      )}

      {/* Transfer Metrics Telemetry Grid */}
      <div className="transfer-telemetry-grid">
        <div className="telemetry-card">
          <span className="telemetry-label">Status</span>
          <span className="telemetry-val text-success">
            {isExpired ? 'Expired' : 'Active & Ready'}
          </span>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-label">Live Expiry Countdown</span>
          <span className={`telemetry-val ${totalSeconds < 300 ? 'text-warning' : 'text-primary'}`}>
            <Clock size={14} /> {isExpired ? 'Expired' : `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`}
          </span>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-label">Download Policy</span>
          <span className="telemetry-val">
            {getDownloadLimitText()}
          </span>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-label">Files &amp; Payload</span>
          <span className="telemetry-val">
            {result.fileCount || 1} file(s) ({formatBytes(result.originalSize)})
          </span>
        </div>
      </div>

      {/* 10-Digit Transfer Code Card */}
      <div className="crypto-code-box">
        <div className="crypto-code-header">
          <label className="crypto-code-label--success">
            <Key size={16} /> 10-Digit Transfer Code
          </label>
          <span className="code-hint-badge">Share this code with receiver</span>
        </div>
        <div className="crypto-code-display-row">
          <div className="crypto-code-text">{result.transferCode}</div>
          <button
            type="button"
            className="btn btn-primary btn-md copy-code-btn"
            onClick={onCopy}
            title="Copy 10-digit code to clipboard"
          >
            {copied ? (
              <>
                <CheckCircle2 size={16} /> Copied!
              </>
            ) : (
              <>
                <Copy size={16} /> Copy Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* QR Code Card */}
      {shareUrl && (
        <div className="qr-code-box animate-in">
          <div className="qr-heading">
            <div className="qr-heading-left">
              <QrCode size={18} />
              <strong className="qr-heading-title">Scan QR Code to Download</strong>
            </div>
            <span className="badge badge-primary">
              QR Tokens: {refreshCount}/{MAX_REFRESHES}
            </span>
          </div>

          <div className="qr-code-wrapper">
            <QRCodeSVG value={shareUrl} size={170} level="M" includeMargin={false} />
          </div>

          <div className="qr-actions-row">
            {!refreshLimitReached && (
              <button
                type="button"
                onClick={onRefreshQRToken}
                disabled={isRefreshingToken}
                className="btn btn-secondary btn-sm"
                title="Rotate access token for security"
              >
                <RefreshCw size={14} className={isRefreshingToken ? 'spin' : ''} />
                Rotate QR Token
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleWhatsAppShare}
              title="Share transfer link directly on WhatsApp"
            >
              <Share2 size={14} /> WhatsApp Share
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleShareMessage}
              title="Copy formatted transfer message with link"
            >
              <Copy size={14} /> {copiedShareMsg ? 'Message Copied!' : 'Copy Share Message'}
            </button>
          </div>
        </div>
      )}

      {/* Danger Zone: Sender Instant Cancel / Delete */}
      <div className="result-actions-footer">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="btn btn-danger btn-md"
          title="Permanently remove file from server now"
        >
          <Trash2 size={16} />
          {isCancelling ? 'Deleting...' : 'Cancel & Purge File Now'}
        </button>

        <button
          type="button"
          onClick={onNewUpload}
          className="btn btn-primary btn-md"
          title="Start sending another file"
        >
          <Plus size={16} /> Send Another File
        </button>
      </div>
    </div>
  );
}
