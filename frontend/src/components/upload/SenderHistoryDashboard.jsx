import React, { useState, useEffect } from 'react';
import {
  Clock, Key, Copy, Trash2, CheckCircle2,
  Flame, HardDrive, Eye
} from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { copyToClipboard } from '../../utils/clipboard';
import { api } from '../../services/api';
import { getSenderHistory, removeTransferFromHistory, updateTransferInHistory, clearAllTransferHistory } from '../../services/transferHistory';

/**
 * SenderHistoryDashboard Component
 * Primary Responsibility: Display sender's transfer hub, monitoring active countdown timers
 * and providing quick code copy, QR display, and cancellation controls.
 * Note: Users never see download counts, download history, or internal transfer statistics.
 */
export function SenderHistoryDashboard({ onSelectTransferForQR, activeTransferId }) {
  const [history, setHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const reloadHistory = () => {
    setHistory(getSenderHistory());
  };

  useEffect(() => {
    reloadHistory();
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyCode = async (code, fileId) => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedId(fileId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCancelTransfer = async (item) => {
    if (!item?.fileId) return;
    const confirmCancel = window.confirm(`Are you sure you want to permanently cancel and delete "${item.fileName}" from the server?`);
    if (!confirmCancel) return;

    setCancellingId(item.fileId);
    try {
      const ownerToken = item.ownerToken || sessionStorage.getItem(`fs_owner_${item.fileId}`);
      if (ownerToken) {
        await api.cancel(item.fileId, ownerToken);
      }
      updateTransferInHistory(item.fileId, { status: 'cancelled' });
      reloadHistory();
    } catch (err) {
      console.warn('Could not cancel server transfer:', err);
      updateTransferInHistory(item.fileId, { status: 'cancelled' });
      reloadHistory();
    } finally {
      setCancellingId(null);
    }
  };

  const handleRemoveRecord = (fileId) => {
    removeTransferFromHistory(fileId);
    reloadHistory();
  };

  if (history.length === 0) {
    return null;
  }

  const formatRemainingTime = (expiresAt) => {
    if (!expiresAt) return 'No expiry set';
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return 'Expired';
    const totalSecs = Math.floor(diff / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s remaining`;
  };

  return (
    <div className="sender-history-section animate-in" aria-label="Active Transfers Dashboard">
      <div className="sender-history-header">
        <div className="sender-history-title-group">
          <HardDrive size={18} className="sender-history-icon" />
          <h3 className="sender-history-title">My Shared Transfers</h3>
          <span className="badge badge-primary">{history.length}</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => {
            if (window.confirm('Clear all transfer history records from this browser?')) {
              clearAllTransferHistory();
              reloadHistory();
            }
          }}
          title="Clear local transfer history"
        >
          Clear History
        </button>
      </div>

      <div className="sender-history-grid">
        {history.map((item) => {
          const isExpired = item.expiresAt && new Date(item.expiresAt).getTime() <= now;
          const isCancelled = item.status === 'cancelled';
          const isBurn = Boolean(item.burnOnRead ?? item.burn_on_read) || item.maxDownloads === 1;
          const isCurrent = item.fileId === activeTransferId;

          return (
            <div
              key={item.fileId}
              className={`sender-history-card ${isCurrent ? 'sender-history-card--current' : ''} ${isExpired || isCancelled ? 'sender-history-card--inactive' : ''}`}
            >
              <div className="history-card-top">
                <div className="history-card-info">
                  <div className="history-card-name-row">
                    <strong className="history-card-name" title={item.fileName}>
                      {item.fileName}
                    </strong>
                    {isCurrent && <span className="badge badge-emerald">Active Now</span>}
                    {isCancelled && <span className="badge badge-danger">Cancelled</span>}
                    {isExpired && !isCancelled && <span className="badge badge-slate">Expired</span>}
                    {!isExpired && !isCancelled && isBurn && (
                      <span className="badge badge-amber">
                        <Flame size={12} /> Burn on Read
                      </span>
                    )}
                  </div>
                  <div className="history-card-meta">
                    <span>{formatBytes(item.fileSize)}</span>
                    <span className="dot-sep">•</span>
                    <span>{item.fileCount} file{item.fileCount > 1 ? 's' : ''}</span>
                    <span className="dot-sep">•</span>
                    <span className="history-time-badge">
                      <Clock size={12} /> {formatRemainingTime(item.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="history-code-strip">
                <span className="history-code-val">
                  <Key size={13} /> {item.transferCode || item.fileId}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => handleCopyCode(item.transferCode || item.fileId, item.fileId)}
                  title="Copy 10-digit transfer code"
                >
                  {copiedId === item.fileId ? (
                    <>
                      <CheckCircle2 size={12} style={{ color: 'var(--success-fg)' }} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="history-card-footer">
                <div className="history-status-pill">
                  {isCancelled ? (
                    <span className="status-text text-muted">Deleted from server</span>
                  ) : isExpired ? (
                    <span className="status-text text-muted">Auto-purged on expiry</span>
                  ) : isBurn ? (
                    <span className="status-text text-warning">Active • Burn on Read</span>
                  ) : (
                    <span className="status-text text-primary">Active &amp; Ready</span>
                  )}
                </div>

                <div className="history-card-actions">
                  {onSelectTransferForQR && !isExpired && !isCancelled && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => onSelectTransferForQR(item)}
                      title="View QR Code and sharing link"
                    >
                      <Eye size={13} /> QR
                    </button>
                  )}

                  {!isExpired && !isCancelled ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      onClick={() => handleCancelTransfer(item)}
                      disabled={cancellingId === item.fileId}
                      title="Cancel and permanently delete file from server"
                    >
                      <Trash2 size={13} /> Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleRemoveRecord(item.fileId)}
                      title="Remove from history list"
                    >
                      <Trash2 size={13} /> Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
