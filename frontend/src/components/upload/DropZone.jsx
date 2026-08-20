import React from 'react';
import { Upload } from 'lucide-react';
import { formatBytes } from '../../utils/format';

/**
 * Upload DropZone Component
 * Primary Responsibility: Handle file drag-and-drop area and file input picker triggers.
 */
export function DropZone({
  files,
  isDragging,
  totalSelectedSize,
  supportsMultiple,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect
}) {
  return (
    <div
      className={`drop-zone ${files.length > 0 ? 'file-selected' : ''} ${isDragging ? 'drag-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload files drop zone. Click or drag and drop files here."
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
    >
      <div className="drop-icon-wrapper">
        <Upload size={26} />
      </div>
      <h3>{files.length > 0 ? `${files.length} file(s) selected` : 'Choose files or drag here'}</h3>
      <p>
        {files.length > 0
          ? `${formatBytes(totalSelectedSize)} selected • ${files.length} of max 20 file(s)`
          : 'Select up to 20 files • Up to 1 GB total'}
      </p>
      <input
        ref={fileInputRef}
        type="file"
        className="file-input"
        multiple={supportsMultiple}
        onChange={onFileSelect}
        aria-hidden="true"
      />
    </div>
  );
}
