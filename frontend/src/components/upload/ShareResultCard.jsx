import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, Copy, Trash2, Plus, Flame, Key, Clock,
  ShieldCheck, Share2, Eye, Radio, Users, FileText, Check
} from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { copyToClipboard } from '../../utils/clipboard';
import { createShareMessage, parseTransferCode, computeAccessProof } from '../../crypto';
import { api } from '../../services/api';
import { updateTransferInHistory } from '../../services/transferHistory';
import { FileCategoryIcon } from '../common/FileCategoryIcon';

/**
 * ShareResultCard Component
 * Primary Responsibility: Active Sender Dashboard Card rendered after successful upload.
 * Displays clean, organized telemetry boxes focused on the 10-Digit Transfer Code:
 * 1. File Preview
 * 2. 10-Digit Transfer Code (Copy, WhatsApp, Share Text)
 * 3. Expiry Countdown
 * 4. Download Count & Limits
 * 5. Active Users & Receivers
 * 6. Transfer Status & Cryptography
 */
export function ShareResultCard({
  result,
  shareUrl,
  copied,
  onCopy,
  onNewUpload,
  onCancel,
  isCancelling,
  onPreviewFile,
  p2pState = 'idle'
}) {
  const [now, setNow] = useState(Date.now());
  const [copiedShareMsg, setCopiedShareMsg] = useState(false);
  const [liveInfo, setLiveInfo] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!result?.fileId || !result?.transferCode) return;
    const parsed = parseTransferCode(result.transferCode);
    if (!parsed.key) return;

    let mounted = true;
    const updateStats = async () => {
      try {
        const proof = await computeAccessProof(parsed.key);
        const data = await api.fileInfo(result.fileId, proof);
        if (mounted && data) {
          setLiveInfo(data);
          updateTransferInHistory(result.fileId, {
            downloadCount: data.download_count ?? data.downloadCount ?? 0,
            downloadsRemaining: data.downloads_remaining ?? data.downloadsRemaining,
            status: data.status || 'active'
          });
        }
      } catch (err) {
        if (mounted && (err.status === 410 || (err.message && (err.message.includes('expired') || err.message.includes('limit') || err.message.includes('burned'))))) {
          updateTransferInHistory(result.fileId, {
            status: 'expired'
          });
        }
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [result?.fileId, result?.transferCode]);

  if (!result) return null;

  const isBurn = Boolean(result.burnOnRead ?? result.burn_on_read) || result.maxDownloads === 1;
  const expiresAtVal = liveInfo?.expires_at || liveInfo?.expiresAt || result.expiresAt || result.expires_at;
  const expiresTimestamp = expiresAtVal ? new Date(expiresAtVal).getTime() : 0;
  const remainingMillis = Math.max(0, expiresTimestamp - now);
  const totalSeconds = Math.floor(remainingMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isExpired = remainingMillis <= 0;

  const downloadsUsed = liveInfo?.download_count ?? liveInfo?.downloadCount ?? result.downloadCount ?? result.download_count ?? 0;
  const maxDownloads = liveInfo?.max_downloads ?? liveInfo?.maxDownloads ?? result.maxDownloads ?? result.max_downloads ?? 10;
  const remainingDownloads = liveInfo?.downloads_remaining !== undefined && liveInfo?.downloads_remaining !== null
    ? liveInfo.downloads_remaining
    : liveInfo?.downloadsRemaining !== undefined && liveInfo?.downloadsRemaining !== null
    ? liveInfo.downloadsRemaining
    : result.downloadsRemaining !== undefined && result.downloadsRemaining !== null
    ? result.downloadsRemaining
    : result.downloads_remaining !== undefined && result.downloads_remaining !== null
    ? result.downloads_remaining
    : maxDownloads > 0
    ? Math.max(0, maxDownloads - downloadsUsed)
    : null;

  const downloadProgressPercent = maxDownloads > 0
    ? Math.min(100, Math.round((downloadsUsed / maxDownloads) * 100))
    : 0;

  const handleShareMessage = async () => {
    const msg = createShareMessage({
      transferCode: result.transferCode,
      shareUrl,
      expiryHours: 60,
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
      expiryHours: 60,
      fileCount: result.fileCount || 1,
      totalSize: formatBytes(result.originalSize)
    });
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="upload-result sender-dashboard animate-in" role="region" aria-label="Sender Transfer Dashboard">
      {/* Success Banner */}
      <div className="result-header-banner">
        <div className="result-success-icon-wrap">
          <CheckCircle2 size={28} className="result-success-icon" />
        </div>
        <div className="result-header-text">
          <h3 className="result-title">Encrypted &amp; Ready to Share!</h3>
          <p className="result-subtitle">
            Your file was encrypted in your browser with zero server keys. Share the 10-digit code below to transfer.
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
              Permanently self-destructs and unlinks from server disk immediately after 1 successful download.
            </span>
          </div>
        </div>
      )}

      {/* ── ORGANIZED SENDER TELEMETRY BOXES ── */}
      <div className="sender-dashboard-grid-7">
        {/* BOX 1: FILE PREVIEW */}
        <div className="dashboard-box box-file-preview">
          <div className="dashboard-box-header">
            <div className="box-header-title">
              <FileText size={16} className="box-header-icon" />
              <span>1. File Preview</span>
            </div>
            <span className="badge badge-slate">
              {result.fileCount > 1 ? `${result.fileCount} Files Bundle` : 'Single File'}
            </span>
          </div>
          <div className="box-preview-content">
            <div className="preview-thumb-wrap">
              <FileCategoryIcon fileName={result.originalName} size={28} />
            </div>
            <div className="preview-info-text">
              <strong className="preview-filename" title={result.originalName}>
                {result.originalName}
              </strong>
              <span className="preview-filesize">
                {formatBytes(result.originalSize)} • AES-256 Encrypted
              </span>
            </div>
          </div>
          {onPreviewFile && (
            <button
              type="button"
              className="btn btn-secondary btn-sm box-preview-btn"
              onClick={onPreviewFile}
              title="Inspect file contents in browser"
            >
              <Eye size={13} /> View File Preview
            </button>
          )}
        </div>

        {/* BOX 2: 10-DIGIT TRANSFER CODE */}
        <div className="dashboard-box box-transfer-code">
          <div className="dashboard-box-header">
            <div className="box-header-title">
              <Key size={16} className="box-header-icon" />
              <span>2. Transfer Code</span>
            </div>
            <span className="badge badge-emerald">10 Digits</span>
          </div>
          <div className="dashboard-code-display">
            <span className="dashboard-code-text">{result.transferCode}</span>
          </div>
          <div className="dashboard-code-actions-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-md box-copy-btn"
              onClick={onCopy}
              style={{ flex: 1 }}
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
            <button
              type="button"
              className="btn btn-secondary btn-md"
              onClick={handleWhatsAppShare}
              title="Share transfer code directly on WhatsApp"
            >
              <Share2 size={15} /> WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-md"
              onClick={handleShareMessage}
              title="Copy formatted message with transfer instructions"
            >
              <Copy size={15} /> {copiedShareMsg ? 'Copied' : 'Share Text'}
            </button>
          </div>
          <span className="dashboard-box-hint">
            Give this 10-digit code to recipient to unlock and receive the file.
          </span>
        </div>

        {/* BOX 3: EXPIRY TIME */}
        <div className="dashboard-box box-expiry-time">
          <div className="dashboard-box-header">
            <div className="box-header-title">
              <Clock size={16} className="box-header-icon" />
              <span>3. Expiry Countdown</span>
            </div>
            <span className={`badge ${totalSeconds < 15 ? 'badge-amber' : 'badge-primary'}`}>
              {isExpired ? 'Expired' : `${totalSeconds}s Left`}
            </span>
          </div>
          <div className="dashboard-metric-hero">
            <Clock size={20} className={totalSeconds < 15 ? 'text-warning' : 'text-primary'} />
            <span className={`hero-val ${totalSeconds < 15 ? 'text-warning' : ''}`}>
              {isExpired ? '00:00' : `${minutes > 0 ? `${minutes}m ` : ''}${seconds < 10 ? '0' : ''}${seconds}s`}
            </span>
          </div>
          <p className="dashboard-metric-subtext">
            {isExpired
              ? 'File expired & automatically erased from server.'
              : `Auto-destructs strictly when countdown reaches zero.`}
          </p>
          <div className="dashboard-progress-track">
            <div
              className="dashboard-progress-fill"
              style={{
                width: `${Math.max(0, Math.min(100, (totalSeconds / 180) * 100))}%`,
                backgroundColor: totalSeconds < 15 ? 'var(--warning-fg)' : 'var(--accent)'
              }}
            />
          </div>
        </div>

        {/* BOX 4: DOWNLOAD COUNT & REMAINING LIMITS */}
        <div className="dashboard-box box-download-count">
          <div className="dashboard-box-header">
            <div className="box-header-title">
              <Users size={16} className="box-header-icon" />
              <span>4. Download Count</span>
            </div>
            <span className={`badge ${isBurn ? 'badge-amber' : 'badge-emerald'}`}>
              {isBurn ? 'Burn After Read' : maxDownloads === 0 ? 'Unlimited' : `${remainingDownloads} Left`}
            </span>
          </div>
          <div className="dashboard-metric-hero">
            {isBurn ? (
              <span className="hero-val text-warning">{downloadsUsed} / 1 used</span>
            ) : maxDownloads === 0 ? (
              <span className="hero-val text-success">{downloadsUsed} downloads</span>
            ) : (
              <span className="hero-val">{downloadsUsed} / {maxDownloads} used</span>
            )}
          </div>
          <p className="dashboard-metric-subtext">
            {isBurn
              ? 'Allowed: Exactly 1 download. Self-destructs on completion.'
              : maxDownloads === 0
              ? 'Allowed: Unlimited downloads until countdown timer expires.'
              : `Allowed: ${maxDownloads} max downloads (${remainingDownloads} downloads remaining).`}
          </p>
          {maxDownloads > 0 && (
            <div className="dashboard-progress-track">
              <div
                className="dashboard-progress-fill"
                style={{
                  width: `${downloadProgressPercent}%`,
                  backgroundColor: isBurn ? 'var(--warning-fg)' : 'var(--success-fg)'
                }}
              />
            </div>
          )}
        </div>

        {/* BOX 5: ACTIVE USERS & RECEIVERS */}
        <div className="dashboard-box box-active-users">
          <div className="dashboard-box-header">
            <div className="box-header-title">
              <Radio size={16} className="box-header-icon" />
              <span>5. Active Users</span>
            </div>
            <span className="badge badge-slate">Live Channel</span>
          </div>
          <div className="dashboard-metric-hero">
            <span className="pulse-dot" />
            <span className="hero-val hero-val--subtle">
              {p2pState === 'connected' ? '1 Connected Peer' : 'Waiting for Recipient'}
            </span>
          </div>
          <p className="dashboard-metric-subtext">
            {p2pState === 'connected'
              ? 'Direct peer streaming active. Zero intermediate storage.'
              : 'Signaling listener active. Receiver will connect when code is entered.'}
          </p>
          <div className="active-user-pill">
            <span>STUN / WebRTC Signaling: Ready</span>
          </div>
        </div>

        {/* BOX 6: TRANSFER STATUS & SECURITY */}
        <div className="dashboard-box box-transfer-status">
          <div className="dashboard-box-header">
            <div className="box-header-title">
              <ShieldCheck size={16} className="box-header-icon" />
              <span>6. Transfer Status</span>
            </div>
            <span className="badge badge-emerald">Protected</span>
          </div>
          <div className="dashboard-status-list">
            <div className="status-item-row">
              <Check size={14} className="text-success" />
              <span>AES-256-GCM Zero-Knowledge</span>
            </div>
            <div className="status-item-row">
              <Check size={14} className="text-success" />
              <span>Keys never leave your device</span>
            </div>
            <div className="status-item-row">
              <Check size={14} className="text-success" />
              <span>Auto-purged on expiry/burn</span>
            </div>
          </div>
          <span className="dashboard-box-hint">
            State: {isExpired ? 'Expired' : 'Active & Ready for Download'}
          </span>
        </div>
      </div>

      {/* Sender Actions Footer */}
      <div className="result-actions-footer">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="btn btn-danger btn-md"
          title="Permanently remove file from server immediately"
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

export default ShareResultCard;
