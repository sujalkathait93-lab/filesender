import React from 'react';
import {
  Check,
  FolderDown,
  Eye,
  Download,
  Flame,
  RotateCcw,
  FileText
} from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { FileCategoryIcon } from '../common/FileCategoryIcon';

/**
 * DecryptedFilesList Component
 * Primary Responsibility: Render decrypted file items, bundle list with download-all and per-item download/preview buttons.
 */
export function DecryptedFilesList({
  decryptedFiles,
  fileInfo,
  isBurned,
  decryptedBlobUrl,
  onDownloadSingleFile,
  onDownloadAllFiles,
  onOpenPreview,
  onNewSearch
}) {
  return (
    <div className="success-section animate-in">
      <div className="success-icon-container">
        <Check size={28} />
      </div>
      <h3>Transfer Decrypted Successfully</h3>

      {/* Multi-File Bundle List */}
      {decryptedFiles.length > 1 ? (
        <div className="unpacked-files-container">
          <div className="unpacked-header">
            <h4 className="unpacked-title">
              Files in Transfer ({decryptedFiles.length})
            </h4>
            <button
              className="btn btn-primary btn-sm"
              onClick={onDownloadAllFiles}
            >
              <FolderDown size={14} /> Download All ({decryptedFiles.length})
            </button>
          </div>

          <div className="unpacked-files-list">
            {decryptedFiles.map((file, idx) => (
              <div key={idx} className="file-item">
                <div className="file-item-left">
                  <div className="file-icon file-icon--success">
                    <FileCategoryIcon fileName={file.name} mimeType={file.type} size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="file-item-name">{file.name}</div>
                    <div className="file-item-size">{formatBytes(file.size)}</div>
                  </div>
                </div>

                <div className="file-row-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenPreview(file, idx)}
                    title="Preview this file"
                  >
                    <Eye size={13} /> Preview
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onDownloadSingleFile(file)}
                    title="Download this file"
                  >
                    <Download size={13} /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="success-file-box">
          <div className="success-file-details">
            <div className="file-icon file-icon--success">
              <FileText size={18} />
            </div>
            <div>
              <strong className="success-file-name">
                {decryptedFiles[0]?.name || fileInfo?.original_name}
              </strong>
              <span className="success-file-size">
                {formatBytes(decryptedFiles[0]?.size || fileInfo?.original_size)}
              </span>
            </div>
          </div>
        </div>
      )}

      {isBurned && (
        <div className="burn-banner">
          <Flame size={20} className="burn-icon" />
          <div>
            <strong className="burn-title">File Self-Destructed &amp; Purged!</strong>
            <p className="burn-copy">
              The server permanently deleted this file after your download.
            </p>
          </div>
        </div>
      )}

      {decryptedFiles.length <= 1 && decryptedBlobUrl && (
        <a
          href={decryptedBlobUrl}
          download={decryptedFiles[0]?.name || fileInfo?.original_name}
          className="btn btn-primary btn-lg full-width success-download-link"
        >
          <Download size={18} /> Save File to Downloads
        </a>
      )}

      <button className="btn btn-secondary button-block" onClick={onNewSearch}>
        <RotateCcw size={15} /> Receive Another File
      </button>
    </div>
  );
}
