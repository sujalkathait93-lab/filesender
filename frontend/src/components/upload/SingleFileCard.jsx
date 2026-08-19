import React, { useState, useEffect } from 'react';
import { Eye, X, ChevronUp, ChevronDown, Zap, Sliders, Settings2, Image as ImageIcon } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { OPTIMIZATION_TIERS } from '../../services/smartTransferOptimizer';
import { FileCategoryIcon } from '../common/FileCategoryIcon';

/**
 * SingleFileCard Component
 * Primary Responsibility: Render single-file visual preview thumbnail, metadata, smart metrics, and optimization override controls.
 */
export function SingleFileCard({
  file,
  currentOpt,
  isTransferring,
  showAdvancedDetails,
  setShowAdvancedDetails,
  showCustomOverride,
  setShowCustomOverride,
  customSettings,
  updateCustomSettings,
  resetToSmartDefaults,
  onOpenPreview,
  onRemoveFile
}) {
  const [thumbUrl, setThumbUrl] = useState(null);

  useEffect(() => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      setThumbUrl(null);
      return undefined;
    }
    let url = null;
    try {
      url = URL.createObjectURL(file);
      setThumbUrl(url);
    } catch (_) {}

    return () => {
      if (url) {
        try { URL.revokeObjectURL(url); } catch (_) {}
      }
    };
  }, [file]);

  if (!file || !currentOpt) return null;

  return (
    <div className="smart-single-card animate-in">
      <div className="smart-single-header">
        {/* Visual Thumbnail or Category Icon */}
        {thumbUrl ? (
          <div
            className="file-thumb-container"
            onClick={() => onOpenPreview(file)}
            title="Click to zoom image preview"
            role="button"
            tabIndex={0}
          >
            <img src={thumbUrl} alt={file.name} className="file-thumb-img" />
            <div className="file-thumb-overlay">
              <Eye size={14} />
            </div>
          </div>
        ) : (
          <div className="file-icon file-icon--success">
            <FileCategoryIcon fileName={file.name} mimeType={file.type} size={20} />
          </div>
        )}

        <div className="smart-single-info">
          <div className="smart-single-name" title={file.name}>{file.name}</div>
          <div className="smart-single-sub">
            <span className="file-size-badge">{formatBytes(file.size)}</span>
            <span className="dot-sep">•</span>
            <span className="smart-mode-tag">{currentOpt.mode}</span>
          </div>
        </div>

        <div className="file-row-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview(file);
            }}
            disabled={isTransferring}
            title={`Preview ${file.name}`}
            aria-label={`Preview ${file.name}`}
          >
            <Eye size={13} /> Preview
          </button>
          <button
            className="file-remove-btn"
            onClick={onRemoveFile}
            disabled={isTransferring}
            aria-label={`Remove ${file.name}`}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Advanced Details Toggle Button */}
      <div className="smart-details-bar">
        <button
          type="button"
          className="smart-toggle-btn"
          onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
          aria-expanded={showAdvancedDetails}
        >
          <span>Optimization Telemetry</span>
          {showAdvancedDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Collapsible Advanced Details Content */}
      {showAdvancedDetails && (
        <div className="smart-details-accordion animate-in">
          <div className="smart-metrics-grid">
            <div className="smart-metric-item">
              <span className="smart-metric-label">Transfer Mode</span>
              <strong className="smart-metric-val">{currentOpt.mode}</strong>
            </div>
            <div className="smart-metric-item">
              <span className="smart-metric-label">Chunk Size</span>
              <strong className="smart-metric-val">{currentOpt.chunkSizeLabel || 'Direct Stream'}</strong>
            </div>
            <div className="smart-metric-item">
              <span className="smart-metric-label">Buffer Level</span>
              <strong className="smart-metric-val">{currentOpt.bufferLevel}</strong>
            </div>
            <div className="smart-metric-item">
              <span className="smart-metric-label">Max Parallelism</span>
              <strong className="smart-metric-val">{currentOpt.maxParallelism}</strong>
            </div>
          </div>

          <div className="smart-details-footer">
            <span className="smart-strategy-hint">
              <Zap size={13} className="hint-icon" />
              {currentOpt.description}
            </span>

            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setShowCustomOverride(!showCustomOverride)}
              style={{ fontSize: '0.75rem', gap: 4 }}
            >
              <Sliders size={12} /> {showCustomOverride ? 'Hide Customizer' : 'Manual Override'}
            </button>
          </div>

          {/* Optional Custom Configuration Override */}
          {showCustomOverride && (
            <div className="smart-custom-panel animate-in">
              <div className="custom-panel-header">
                <strong><Settings2 size={13} /> Custom Configuration Controls</strong>
                {customSettings && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={resetToSmartDefaults}
                  >
                    Reset to Smart Defaults
                  </button>
                )}
              </div>
              <div className="custom-panel-row">
                <label>Transfer Mode</label>
                <select
                  value={currentOpt.mode}
                  onChange={(e) => {
                    const selectedTier = OPTIMIZATION_TIERS.find(t => t.mode === e.target.value);
                    if (selectedTier) {
                      updateCustomSettings({
                        mode: selectedTier.mode,
                        chunkSize: selectedTier.chunkSize,
                        chunkSizeLabel: selectedTier.chunkSizeLabel,
                        bufferLevel: selectedTier.bufferLevel,
                        maxParallelism: selectedTier.maxParallelism
                      });
                    }
                  }}
                >
                  {OPTIMIZATION_TIERS.map((tier) => (
                    <option key={tier.mode} value={tier.mode}>
                      {tier.mode} ({tier.chunkSizeLabel} chunks &bull; {tier.bufferLevel} buffer &bull; {tier.maxParallelism}x)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
