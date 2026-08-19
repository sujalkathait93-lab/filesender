import React from 'react';
import { FileText, Flame, Radio, Key, Loader2, Eye, Lock, ShieldCheck, Clock } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { MeasurableProgressBar } from '../FeedbackStates';

/**
 * DownloadFileCard Component
 * Primary Responsibility: Render file information card before decryption, metadata, burn warning, key prompt, and download triggers.
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
  if (!fileInfo) return null;

  const isBurn = Boolean(fileInfo.burn_on_read) || fileInfo.max_downloads === 1;
  const remainingDownloads = fileInfo.downloads_remaining !== undefined && fileInfo.downloads_remaining !== null
    ? fileInfo.downloads_remaining
    : fileInfo.max_downloads > 0
    ? Math.max(0, fileInfo.max_downloads - fileInfo.download_count)
    : null;

  const getStatusText = () => {
    if (isBurn) {
      return 'Active (1 download remaining • Burn After Read)';
    }
    if (fileInfo.max_downloads === 0) {
      return 'Unlimited (Active until expiry)';
    }
    return `Active • ${fileInfo.download_count} of ${fileInfo.max_downloads} used (${remainingDownloads} remaining)`;
  };

  return (
    <div className="file-info animate-in" role="region" aria-label="Transfer Details">
      <div className="file-info-header">
        <div className="file-icon file-icon--success">
          <FileText size={20} />
        </div>
        <div className="file-details">
          <h4>{fileInfo.original_name}</h4>
          <p>
            {formatBytes(fileInfo.original_size)} • Expires {new Date(fileInfo.expires_at).toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div className="file-meta">
        <div className="meta-item">
          <label>Total Size</label>
          <span>{formatBytes(fileInfo.original_size)}</span>
        </div>
        <div className="meta-item">
          <label>Download Status</label>
          <span>{getStatusText()}</span>
        </div>
        <div className="meta-item">
          <label>Expires At</label>
          <span>{new Date(fileInfo.expires_at).toLocaleTimeString()}</span>
        </div>
      </div>

      {isBurn && !isBurned && (
        <div className="burn-banner">
          <Flame size={20} className="burn-icon" />
          <div>
            <strong className="burn-title">Burn After Read Active</strong>
            <span className="burn-copy">
              File permanently self-destructs from the server immediately after your download.
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

      {needsKey && !isBurned && (
        <div className="manual-key-section">
          <div className="status-message info">
            <Key size={16} />
            <span>Decryption key required</span>
          </div>
          <input
            type="text"
            placeholder="Paste decryption key..."
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
            onClick={() => onExecuteDownload(false, onPreviewReady)}
            disabled={isDecrypting}
            className="btn btn-secondary btn-lg"
            title="View files in browser without downloading"
            aria-label="Preview files in browser"
          >
            {isDecrypting ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
            <span>Preview Files</span>
          </button>
          <button
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
                <Lock size={16} /> Save &amp; Download
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
