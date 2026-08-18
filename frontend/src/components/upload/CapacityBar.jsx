import React from 'react';
import { formatBytes } from '../../utils/format';
import { MAX_TOTAL_TRANSFER_SIZE } from '../../utils/fileValidator';

/**
 * CapacityBar Component
 * Primary Responsibility: Display progress bar and size metric indicating current selection against the 1 GB transfer capacity.
 */
export function CapacityBar({ totalSelectedSize, isOverLimit }) {
  return (
    <div className="capacity-bar-container">
      <div className="capacity-labels">
        <span>Selected: {formatBytes(totalSelectedSize)}</span>
        <span>1 GB / File Max</span>
      </div>
      <progress
        className={`capacity-progress ${isOverLimit ? 'capacity-progress--error' : ''}`}
        value={Math.min(totalSelectedSize, MAX_TOTAL_TRANSFER_SIZE)}
        max={MAX_TOTAL_TRANSFER_SIZE}
        aria-label="Selected file size"
      />
    </div>
  );
}
