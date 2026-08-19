import React, { useState, useEffect } from 'react';
import {
  Clock, Key, Copy, Trash2, CheckCircle2, AlertCircle,
  Flame, HardDrive, RefreshCw, Eye, ShieldCheck, ChevronRight, Users
} from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { copyToClipboard } from '../../utils/clipboard';
import { parseTransferCode, computeAccessProof } from '../../crypto';
import { api } from '../../services/api';
import { getSenderHistory, removeTransferFromHistory, updateTransferInHistory, clearAllTransferHistory } from '../../services/transferHistory';

/**
 * SenderHistoryDashboard Component
 * Primary Responsibility: Display sender's transfer hub, monitoring live download counts,
 * active countdown timers, remaining downloads, and quick delete/cancel controls.
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

  // Periodic background sync of active transfer download metrics
  useEffect(() => {
    let mounted = true;
    const syncActiveTransfers = async () => {
      const currentList = getSenderHistory();
      const activeList = currentList.filter(
        (item) => item.status !== 'cancelled' && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now())
      );

      for (const item of activeList) {
        if (!mounted) break;
        if (!item.fileId) continue;
        const code = item.transferCode || '';
        const parsed = parseTransferCode(code);
        if (!parsed.key) continue;

        try {
          const proof = await computeAccessProof(parsed.key);
          const data = await api.fileInfo(item.fileId, proof);
          if (mounted && data) {
            updateTransferInHistory(item.fileId, {
              downloadCount: data.download_count ?? data.downloadCount ?? 0,
              downloadsRemaining: data.downloads_remaining ?? data.downloadsRemaining,
              status: data.status || 'active'
            });
          }
        } catch (err) {
          if (mounted && (err.status === 410 || (err.message && (err.message.includes('expired') || err.message.includes('limit') || err.message.includes('burned'))))) {
            updateTransferInHistory(item.fileId, {
              status: 'expired'
            });
          }
        }
      }
      if (mounted) {
        setHistory(getSenderHistory());
      }
    };

    const syncTimer = setInterval(syncActiveTransfers, 5000);
    return () => {
      mounted = false;
      clearInterval(syncTimer);
    };
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
      // Still mark as removed locally
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
          const downloadsUsed = Number(item.downloadCount ?? item.download_count ?? 0);
          const maxDownloads = Number(item.maxDownloads ?? item.max_downloads ?? 10);
          const remainingDownloads = item.downloadsRemaining !== undefined && item.downloadsRemaining !== null
            ? item.downloadsRemaining
            : item.downloads_remaining !== undefined && item.downloads_remaining !== null
            ? item.downloads_remaining
            : maxDownloads > 0
            ? Math.max(0, maxDownloads - downloadsUsed)
            : null;

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

              {/* 10-Digit Code Display & Quick Copy */}
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

              {/* Status & Actions Footer */}
              <div className="history-card-footer">
                <div className="history-status-pill">
                  {isCancelled ? (
                    <span className="status-text text-muted">Deleted from server</span>
                  ) : isExpired ? (
                    <span className="status-text text-muted">Auto-purged on expiry • {downloadsUsed} total downloads</span>
                  ) : isBurn ? (
                    <span className="status-text text-warning">
                      {downloadsUsed}/1 used • {Math.max(0, 1 - downloadsUsed)} remaining (Burn on Read)
                    </span>
                  ) : maxDownloads === 0 ? (
                    <span className="status-text text-success">
                      {downloadsUsed} total downloads • Unlimited remaining
                    </span>
                  ) : (
                    <span className="status-text text-primary">
                      {downloadsUsed} / {maxDownloads} total downloads ({remainingDownloads} remaining)
                    </span>
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
