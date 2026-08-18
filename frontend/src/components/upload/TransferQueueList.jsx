import React from 'react';
import { Eye, X, ChevronUp, ChevronDown } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { SmartTransferOptimizer } from '../../services/smartTransferOptimizer';
import { FileCategoryIcon } from '../common/FileCategoryIcon';

/**
 * TransferQueueList Component
 * Primary Responsibility: Render multi-file transfer queue table and queue scheduling metrics.
 */
export function TransferQueueList({
  files,
  totalSelectedSize,
  batchAnalysis,
  isTransferring,
  showAdvancedDetails,
  setShowAdvancedDetails,
  onOpenPreview,
  onRemoveFile
}) {
  if (!files || files.length <= 1) return null;

  return (
    <div className="smart-multi-card animate-in">
      <div className="smart-multi-summary">
        <div className="summary-left">
          <span className="summary-count">{files.length} Files Selected</span>
          <span className="summary-size">Total: {formatBytes(totalSelectedSize)}</span>
        </div>
        <div className="summary-right">
          <span className="queue-indicator">Queue: {files.length} files</span>
        </div>
      </div>

      <div className="selected-files-list">
        {files.map((f, idx) => {
          const fOpt = SmartTransferOptimizer.analyzeFile(f);
          return (
            <div key={idx} className="file-item">
              <div className="file-item-left">
                <span className="queue-idx">{idx + 1}.</span>
                <div className="file-icon file-icon--success">
                  <FileCategoryIcon fileName={f.name} mimeType={f.type} size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="file-item-name">{f.name}</div>
                  <div className="file-item-size">
                    {formatBytes(f.size)} &bull; <span className="smart-mode-tag-sm">{fOpt.mode}</span>
                  </div>
                </div>
              </div>
              <div className="file-row-actions">
                <span className="badge badge-slate queue-status-badge">Ready</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPreview(f);
                  }}
                  disabled={isTransferring}
                  title={`Preview ${f.name}`}
                >
                  <Eye size={13} />
                </button>
                <button
                  className="file-remove-btn"
                  onClick={() => onRemoveFile(idx)}
                  disabled={isTransferring}
                  aria-label={`Remove ${f.name}`}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-file Advanced Queue Details */}
      <div className="smart-details-bar">
        <button
          type="button"
          className="smart-toggle-btn"
          onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
          aria-expanded={showAdvancedDetails}
        >
          <span>Queue &amp; Parallelism Details</span>
          {showAdvancedDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showAdvancedDetails && (
        <div className="smart-details-accordion animate-in">
          <div className="smart-metrics-grid">
            <div className="smart-metric-item">
              <span className="smart-metric-label">Queue Strategy</span>
              <strong className="smart-metric-val" style={{ fontSize: '0.8rem' }}>
                {batchAnalysis.strategy}
              </strong>
            </div>
            <div className="smart-metric-item">
              <span className="smart-metric-label">Active Large Files</span>
              <strong className="smart-metric-val">1 at a time (Safe)</strong>
            </div>
            <div className="smart-metric-item">
              <span className="smart-metric-label">Backpressure Control</span>
              <strong className="smart-metric-val">Adaptive WebRTC</strong>
            </div>
            <div className="smart-metric-item">
              <span className="smart-metric-label">Chunk Slicing</span>
              <strong className="smart-metric-val">On-Demand RAM Safe</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
