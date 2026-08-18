import React from 'react';
import { Check } from 'lucide-react';
import { formatBytes } from '../../utils/format';

/**
 * TransferProgress Component
 * Primary Responsibility: Display real-time streaming progress, bytes transferred, speed, and ETA during active upload.
 */
export function TransferProgress({
  progress,
  files,
  totalSelectedSize,
  statusMessage
}) {
  if (!progress) return null;

  return (
    <div className="smart-progress-box animate-in">
      <div className="smart-progress-top">
        <div className="smart-progress-file-info">
          <strong className="smart-progress-filename">
            {progress.currentFileName || files[0]?.name}
          </strong>
          {files.length > 1 && (
            <span className="smart-progress-badge">Batch Transfer</span>
          )}
        </div>
        <span className="smart-progress-percent">{progress.percent}%</span>
      </div>

      <div className="smart-progress-bar-wrap">
        <div
          className="smart-progress-bar-fill"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="smart-progress-metrics">
        <span>
          {formatBytes(progress.transferredBytes || 0)} / {formatBytes(progress.totalBytes || totalSelectedSize)}
        </span>
        {progress.speedBytesPerSec > 0 && (
          <span>Speed: {formatBytes(progress.speedBytesPerSec)}/s</span>
        )}
        {progress.etaSeconds > 0 && (
          <span>Remaining: ~{progress.etaSeconds} sec</span>
        )}
      </div>

      <div className="smart-progress-footer">
        <span className="smart-badge-pill sm">
          <Check size={11} className="smart-badge-icon" /> Smart Optimized
        </span>
        <span className="smart-stage-text">{statusMessage}</span>
      </div>
    </div>
  );
}
