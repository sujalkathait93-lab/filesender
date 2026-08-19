import React, { useState, useEffect } from 'react';
import {
  FileText, Flame, Radio, Key, Loader2, Eye, Lock,
  ShieldCheck, Clock, CheckCircle2, Shield, Info, Download
} from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { MeasurableProgressBar } from '../FeedbackStates';
import { FileCategoryIcon } from '../common/FileCategoryIcon';

/**
 * DownloadFileCard Component
 * Primary Responsibility: Render receiver file verification overview, metadata telemetry,
 * download limit policy, zero-knowledge reassurance, and download triggers.
 */
export function DownloadFileCard({
  fileInfo,
  isBurned,
  p2pStatus,
  p2pState,
  needsKey,
  manualKey,
  setManualKey,
  progress,
  isDecrypting,
  statusMessage,
  onExecuteDownload,
  onPreviewReady
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!fileInfo) return null;

  const isBurn = Boolean(fileInfo.burn_on_read) || fileInfo.max_downloads === 1;
  const remainingDownloads = fileInfo.downloads_remaining !== undefined && fileInfo.downloads_remaining !== null
    ? fileInfo.downloads_remaining
    : fileInfo.max_downloads > 0
    ? Math.max(0, fileInfo.max_downloads - fileInfo.download_count)
    : null;

  const expiresTimestamp = fileInfo.expires_at ? new Date(fileInfo.expires_at).getTime() : 0;
  const remainingMillis = Math.max(0, expiresTimestamp - now);
  const totalSeconds = Math.floor(remainingMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isExpired = remainingMillis <= 0;

  const getStatusText = () => {
    if (isBurn) {
      return '1 download remaining (Burn After Read)';
    }
    if (fileInfo.max_downloads === 0) {
      return 'Unlimited downloads until expiry';
    }
    return `${fileInfo.download_count} of ${fileInfo.max_downloads} used (${remainingDownloads} remaining)`;
  };

  return (
    <div className="file-info animate-in" role="region" aria-label="Transfer Verification & Details">
      {/* File Header */}
      <div className="file-info-header">
        <div className="file-icon file-icon--success">
          <FileCategoryIcon fileName={fileInfo.original_name} mimeType={fileInfo.mime_type} size={24} />
        </div>
        <div className="file-details">
          <h4 className="file-details-name">{fileInfo.original_name}</h4>
          <p className="file-details-meta">
            <span className="file-size-badge">{formatBytes(fileInfo.original_size)}</span>
            <span className="dot-sep">•</span>
            <span>Zero-Knowledge AES-256</span>
          </p>
        </div>
      </div>

      {/* Receiver Verification Telemetry Grid */}
      <div className="transfer-telemetry-grid">
        <div className="telemetry-card">
          <span className="telemetry-label">Transfer Size</span>
          <span className="telemetry-val">{formatBytes(fileInfo.original_size)}</span>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-label">Download Policy</span>
          <span className="telemetry-val">{getStatusText()}</span>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-label">Time Remaining</span>
          <span className={`telemetry-val ${totalSeconds < 300 ? 'text-warning' : 'text-primary'}`}>
            <Clock size={13} /> {isExpired ? 'Expired' : `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`}
          </span>
        </div>
        <div className="telemetry-card">
          <span className="telemetry-label">Encryption Seal</span>
          <span className="telemetry-val text-success">
            <ShieldCheck size={13} /> Verified E2E
          </span>
        </div>
      </div>

      {/* Burn After Read Alert */}
      {isBurn && !isBurned && (
        <div className="burn-banner">
          <Flame size={20} className="burn-icon" />
          <div>
            <strong className="burn-title">Burn After Read Active</strong>
            <span className="burn-copy">
              This file permanently self-destructs from the server immediately after your download finishes.
            </span>
          </div>
        </div>
      )}

      {p2pStatus && (p2pState === 'waiting' || p2pState === 'connected') && (
        <div className="status-message info" style={{ marginBottom: 16 }}>
          <Radio size={16} />
          <span>{p2pStatus} REST download below still works.</span>
        </div>
      )}

      {/* Key Prompt if key missing from URL/code */}
      {needsKey && !isBurned && (
        <div className="manual-key-section">
          <div className="status-message info">
            <Key size={16} />
            <span>Decryption key required</span>
          </div>
          <input
            type="text"
            placeholder="Paste 5-char or full decryption key..."
            value={manualKey}
            onChange={(e) => setManualKey(e.target.value)}
            className="manual-key-input"
            aria-label="Decryption key input"
          />
        </div>
      )}

      {/* Progress feedback while decrypting / downloading */}
      {progress && isDecrypting && (
        <div style={{ marginBottom: 16 }}>
          <MeasurableProgressBar
            stage={progress.stage}
            percent={progress.percent}
            statusMessage={statusMessage}
          />
        </div>
      )}

      {!isBurned && (
        <div className="download-actions">
          <button
            type="button"
            onClick={() => onExecuteDownload(false, onPreviewReady)}
            disabled={isDecrypting}
            className="btn btn-secondary btn-lg"
            title="Inspect files in browser without saving to disk"
            aria-label="Preview files in browser"
          >
            {isDecrypting ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
            <span>Preview Files</span>
          </button>
          <button
            type="button"
            onClick={() => onExecuteDownload(true)}
            disabled={isDecrypting}
            aria-busy={isDecrypting}
            className="btn btn-primary btn-lg"
            aria-label="Save and download file"
          >
            {isDecrypting ? (
              <>
                <Loader2 size={16} className="spin" /> Decrypting...
              </>
            ) : (
              <>
                <Download size={16} /> Save &amp; Download
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
