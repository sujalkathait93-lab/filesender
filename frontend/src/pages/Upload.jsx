import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, File, X, Copy, Check, Shield, Lock, Key,
  Image as ImageIcon, Flame, Clock, ArrowLeft, Info,
  RefreshCw, Loader2, Users, Radio, Eye, Trash2,
  FileText, Video, Music, FileCode, ShieldCheck, Sparkles, QrCode
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatBytes, copyToClipboard } from '../crypto'
import { TransferStateMachine, TransferState } from '../stateMachine'
import { MAX_TOTAL_TRANSFER_SIZE, detectFileType } from '../fileManager'
import { useFileUpload } from '../hooks/useFileUpload'
import { useEncryptAndSend } from '../hooks/useEncryptAndSend'
import { useP2PSession } from '../hooks/useP2PSession'
import { MeasurableProgressBar, ErrorAlert } from '../components/FeedbackStates'
import brandLogo from '../image/icons.png'

const MAX_REFRESHES = 5;

export const formatExpiryLabel = (hours) => {
  const mins = Math.round(hours * 60);
  return `${mins} minutes`;
};

function getFileIcon(fileName, mimeType) {
  const category = detectFileType(fileName, mimeType).category;
  switch (category) {
    case 'image': return <ImageIcon size={18} />;
    case 'video': return <Video size={18} />;
    case 'audio': return <Music size={18} />;
    case 'text': return <FileCode size={18} />;
    case 'pdf': return <FileText size={18} />;
    default: return <File size={18} />;
  }
}

function UploadPage() {
  const navigate = useNavigate();
  const [stateMachine] = useState(() => new TransferStateMachine(TransferState.IDLE));
  const [currentState, setCurrentState] = useState(TransferState.IDLE);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [copied, setCopied] = useState(false);

  // Pre-Transfer Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Vault Options
  const [useSteganography, setUseSteganography] = useState(false);
  const [burnOnRead, setBurnOnRead] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState(10);
  const [expiryHours, setExpiryHours] = useState(1);
  const [useP2P, setUseP2P] = useState(false);

  // Sender File Preview State (No timer)
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewText, setPreviewText] = useState(null);

  const confirmCloseRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!showConfirmModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowConfirmModal(false);
    };
    window.addEventListener('keydown', onKey);
    confirmCloseRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [showConfirmModal]);

  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Custom Hooks
  const {
    files,
    isDragging,
    error: fileError,
    setError: setFileError,
    totalSelectedSize,
    remainingCapacity,
    isOverLimit,
    addFiles,
    removeFile,
    clearFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop
  } = useFileUpload(stateMachine);

  const {
    progress,
    result,
    shareUrl,
    stegoSkipped,
    refreshCount,
    isRefreshingToken,
    refreshLimitReached,
    error: sendError,
    sendFiles,
    refreshQRToken,
    cancelTransfer,
    resetSendState
  } = useEncryptAndSend(stateMachine);

  const { p2pStatus, p2pState, startP2P, stopP2P } = useP2PSession();

  const error = fileError || sendError;
  const supportsMultiple = typeof document !== 'undefined' && 'multiple' in document.createElement('input');

  useEffect(() => {
    stateMachine.onStateChange = ({ currentState, userMessage }) => {
      setCurrentState(currentState);
      setStatusMessage(userMessage);
    };
  }, [stateMachine]);

  useEffect(() => {
    if (result && useP2P && result.fileId) startP2P(result.fileId, 'sender');
    return () => stopP2P();
  }, [result, useP2P, startP2P, stopP2P]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    e.target.value = '';
  };

  const handleBurnToggle = () => {
    const nextBurn = !burnOnRead;
    setBurnOnRead(nextBurn);
    if (nextBurn) {
      setMaxDownloads(1);
    } else if (maxDownloads === 1) {
      setMaxDownloads(10);
    }
  };

  const handleMaxDownloadsChange = (val) => {
    const num = Number(val);
    setMaxDownloads(num);
    if (num === 1) {
      setBurnOnRead(true);
    } else {
      setBurnOnRead(false);
    }
  };

  const openConfirmation = () => {
    if (files.length === 0 || isOverLimit || isTransferring) return;
    setFileError(null);
    stateMachine.transitionTo(TransferState.VALIDATE);
    setShowConfirmModal(true);
  };

  const handleConfirmedSend = async () => {
    setShowConfirmModal(false);
    setIsTransferring(true);
    try {
      await sendFiles({
        files,
        useSteganography,
        burnOnRead,
        expiryHours,
        maxDownloads,
        totalSelectedSize
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCopyCode = async () => {
    if (!result) return;
    await copyToClipboard(result.transferCode);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };


  const handleClearAll = () => {
    clearFiles();
    resetSendState();
    stopP2P();
    setCopied(false);
    setIsTransferring(false);
    stateMachine.transitionTo(TransferState.IDLE);
  };

  // Preview local file before upload (no restriction or timer)
  const handleOpenLocalPreview = (fileObj) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(fileObj);
    const detection = detectFileType(fileObj.name, fileObj.type);

    if (detection.category === 'image' || detection.category === 'video' || detection.category === 'audio' || detection.category === 'pdf') {
      const url = URL.createObjectURL(fileObj);
      setPreviewUrl(url);
      setPreviewText(null);
    } else if (detection.category === 'text' || fileObj.size <= 10 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        const textResult = reader.result;
        if (typeof textResult === 'string') {
          // Check for printable text
          const sample = textResult.slice(0, 1000);
          const nonPrintableCount = (sample.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
          if (detection.category === 'text' || (nonPrintableCount / (sample.length || 1) < 0.05)) {
            setPreviewText(textResult);
            setPreviewUrl(null);
            return;
          }
        }
        setPreviewUrl(null);
        setPreviewText(null);
      };
      reader.onerror = () => {
        setPreviewUrl(null);
        setPreviewText(null);
      };
      reader.readAsText(fileObj);
    } else {
      setPreviewUrl(null);
      setPreviewText(null);
    }
  };

  const handleCloseLocalPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewText(null);
  };

  useEffect(() => {
    if (!previewFile) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleCloseLocalPreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFile]);

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Upload /> Send Files</h2>
        <p>Drop your files below (up to 2 GB total). Encrypted end-to-end directly in your browser.</p>
      </div>

      <div className="wizard-steps" role="navigation" aria-label="Transfer Steps">
        <div className={`step ${files.length === 0 && !result ? 'active' : 'completed'}`}>
          <span className="step-num">1</span>
          <span className="step-label">Select Files</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${files.length > 0 && !result ? 'active' : result ? 'completed' : ''}`}>
          <span className="step-num">2</span>
          <span className="step-label">Options &amp; Send</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${result ? 'active completed' : ''}`}>
          <span className="step-num">3</span>
          <span className="step-label">Share Code</span>
        </div>
      </div>

      {!result && (
        <>
          <div
            className={`drop-zone ${files.length > 0 ? 'file-selected' : ''} ${isDragging ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
              <Upload size={32} />
            </div>
            <h3>{files.length > 0 ? `${files.length} file(s) selected` : 'Click or drop files here'}</h3>
            <p>
              {files.length > 0
                ? `${formatBytes(totalSelectedSize)} selected • ${formatBytes(remainingCapacity)} remaining capacity`
                : 'Select single or multiple files • Up to 2 GB total'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="file-input"
              multiple={supportsMultiple}
              onChange={handleFileSelect}
              aria-hidden="true"
            />
          </div>

          {files.length > 0 && (
            <div className="file-info animate-in">
              <div className="file-section-header">
                <h4 className="file-section-heading">
                  Selected Files ({files.length})
                </h4>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAll}
                  disabled={isTransferring}
                >
                  <Trash2 size={13} /> Clear All
                </button>
              </div>

              <div className="selected-files-list">
                {files.map((f, idx) => (
                  <div key={idx} className="file-item">
                    <div className="file-item-left">
                      <div className="file-icon file-icon--success">
                        {getFileIcon(f.name, f.type)}
                      </div>
                      <div>
                        <div className="file-item-name">{f.name}</div>
                        <div className="file-item-size">{formatBytes(f.size)} • {f.type || 'File'}</div>
                      </div>
                    </div>
                    <div className="file-row-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleOpenLocalPreview(f); }}
                        disabled={isTransferring}
                        title={`Preview ${f.name}`}
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        className="file-remove-btn"
                        onClick={() => removeFile(idx)}
                        disabled={isTransferring}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="capacity-bar-container">
                <div className="capacity-labels">
                  <span>Total Size: {formatBytes(totalSelectedSize)}</span>
                  <span>Capacity: 2 GB max</span>
                </div>
                <progress
                  className={`capacity-progress ${isOverLimit ? 'capacity-progress--error' : ''}`}
                  value={totalSelectedSize}
                  max={MAX_TOTAL_TRANSFER_SIZE}
                  aria-label="Selected file size relative to the 2 GB limit"
                />
              </div>

              {/* Enhanced Sharing Options with clear purpose explanations */}
              <div className="vault-settings">
                <h4 className="settings-heading">
                  Sharing &amp; Privacy Options
                </h4>

                {/* Option 1: Burn-on-Read */}
                <div
                  className={`vault-option-card ${burnOnRead ? 'active' : ''}`}
                  onClick={() => !isTransferring && handleBurnToggle()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && handleBurnToggle()}
                >
                  <div className="option-card__content">
                    <div className="option-card__copy">
                      <div className="option-card__icon option-card__icon--danger">
                        <Flame size={20} />
                      </div>
                      <div>
                        <div className="option-card__title-row">
                          <strong className="option-card__title">Burn-on-Read (Self-Destruct)</strong>
                          <span className="badge badge-amber">ONE-TIME USE</span>
                        </div>
                        <span className="option-card__description">
                          <strong>Best for:</strong> .pdf, .docx, .xlsx (Salary slips, bank statements, contracts). Permanently deleted from server 0.1s after first download.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={burnOnRead}
                      disabled={isTransferring}
                      onChange={(e) => { e.stopPropagation(); handleBurnToggle(); }}
                      className="option-checkbox option-checkbox--danger"
                      aria-label="Burn on read"
                    />
                  </div>
                </div>

                {/* Option 2: Image Steganography */}
                <div
                  className={`vault-option-card ${useSteganography ? 'active' : ''}`}
                  onClick={() => !isTransferring && setUseSteganography(!useSteganography)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && setUseSteganography(!useSteganography)}
                >
                  <div className="option-card__content">
                    <div className="option-card__copy">
                      <div className="option-card__icon option-card__icon--success">
                        <ImageIcon size={20} />
                      </div>
                      <div>
                        <div className="option-card__title-row">
                          <strong className="option-card__title">Steganography Image Vault</strong>
                          <span className="badge badge-emerald">STEALTH &lt;10MB</span>
                        </div>
                        <span className="option-card__description">
                          <strong>Best for:</strong> .txt, .env, .pdf, .png (Passwords, crypto keys, ID cards). Disguises encrypted bytes inside normal PNG image pixels.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useSteganography}
                      disabled={isTransferring}
                      onChange={(e) => { e.stopPropagation(); setUseSteganography(e.target.checked); }}
                      className="option-checkbox option-checkbox--success"
                      aria-label="Hide inside an image"
                    />
                  </div>
                </div>

                {/* Option 3: Direct P2P */}
                <div
                  className={`vault-option-card ${useP2P ? 'active' : ''}`}
                  onClick={() => !isTransferring && setUseP2P(!useP2P)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isTransferring && setUseP2P(!useP2P)}
                >
                  <div className="option-card__content">
                    <div className="option-card__copy">
                      <div className="option-card__icon option-card__icon--primary">
                        <Radio size={20} />
                      </div>
                      <div>
                        <div className="option-card__title-row">
                          <strong className="option-card__title">Direct P2P Transfer (WebRTC)</strong>
                          <span className="badge badge-primary">FAST STREAM &gt;500MB</span>
                        </div>
                        <span className="option-card__description">
                          <strong>Best for:</strong> .mp4, .zip, .iso, .psd (Videos, large archives). Streams laptop-to-laptop / phone-to-laptop without server storage.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useP2P}
                      disabled={isTransferring}
                      onChange={(e) => { e.stopPropagation(); setUseP2P(e.target.checked); }}
                      className="option-checkbox option-checkbox--primary"
                      aria-label="Direct P2P same time"
                    />
                  </div>
                </div>

                {/* Download limit selection */}
                <div className="expiry-row">
                  <Users size={18} className="field-icon" />
                  <label htmlFor="downloads-select">Download Limit</label>
                  <select
                    id="downloads-select"
                    value={maxDownloads}
                    disabled={isTransferring}
                    onChange={(e) => handleMaxDownloadsChange(e.target.value)}
                  >
                    <option value={0}>Unlimited downloads (until expiry)</option>
                    <option value={1}>1 download (Burn-on-Read)</option>
                    <option value={5}>5 downloads</option>
                    <option value={10}>10 downloads (Standard)</option>
                    <option value={20}>20 downloads</option>
                    <option value={50}>50 downloads</option>
                    <option value={100}>100 downloads</option>
                  </select>
                </div>

                {/* Expiry selection up to 60 minutes only */}
                <div className="expiry-row">
                  <Clock size={18} className="field-icon" />
                  <label htmlFor="expiry-select">Code Expiry (Up to 60 Minutes)</label>
                  <select
                    id="expiry-select"
                    value={expiryHours}
                    disabled={isTransferring}
                    onChange={(e) => setExpiryHours(Number(e.target.value))}
                  >
                    <option value={0.25}>15 minutes</option>
                    <option value={0.5}>30 minutes</option>
                    <option value={0.75}>45 minutes</option>
                    <option value={1}>60 minutes (Max)</option>
                  </select>
                </div>
              </div>

              {/* Progress Bar with Percentage and Stage */}
              {progress && (
                <div className="section-stack">
                  <MeasurableProgressBar
                    stage={progress.stage}
                    percent={progress.percent}
                    statusMessage={statusMessage}
                  />
                </div>
              )}

              <div className="action-row section-stack--large">
                <button
                  onClick={openConfirmation}
                  disabled={isTransferring || isOverLimit || files.length === 0}
                  aria-busy={isTransferring}
                  className="btn btn-primary btn-lg full-width"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 size={18} className="spin" /> Encrypting &amp; Uploading...
                    </>
                  ) : (
                    <>
                      <Lock size={18} /> Review &amp; Encrypt Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && !isTransferring && (
        <div className="section-stack">
          <ErrorAlert message={error} onRetry={openConfirmation} />
        </div>
      )}

      {/* Pre-Transfer Confirmation Modal */}
      {showConfirmModal && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Confirm Transfer Details">
          <div className="preview-modal modal-narrow">
            <div className="preview-header">
              <h3><Shield size={20} /> Confirm Transfer Details</h3>
              <button className="preview-close" onClick={() => setShowConfirmModal(false)} aria-label="Close modal" ref={confirmCloseRef}>
                <X size={20} />
              </button>
            </div>
            <div className="preview-body">
              <div className="security-notice confirmation-notice">
                Please review your selected files and security settings before starting the encrypted transfer.
              </div>

              <div className="meta-item confirmation-row">
                <label>Selected Files</label>
                <span className="word-break">{files.length} file(s) ({files.map(f => f.name).join(', ')})</span>
              </div>
              <div className="meta-item confirmation-row">
                <label>Total Size</label>
                <span>{formatBytes(totalSelectedSize)}</span>
              </div>
              <div className="meta-item confirmation-row">
                <label>Sharing Mode</label>
                <span className="text-success">
                  {useSteganography && burnOnRead ? 'Burn-on-Read + Steganography' : useSteganography ? 'Image/Steganography' : burnOnRead ? 'Burn-on-Read' : 'Standard AES-256-GCM'}
                </span>
              </div>
              <div className="meta-item confirmation-row">
                <label>Download Limit</label>
                <span className={maxDownloads === 0 ? 'text-success' : ''}>
                  {maxDownloads === 0 ? 'Unlimited downloads until expiry' : maxDownloads === 1 ? '1 download (Burn-on-Read)' : `${maxDownloads} downloads`}
                </span>
              </div>
              <div className="meta-item">
                <label>Code Expiry</label>
                <span>{formatExpiryLabel(expiryHours)}</span>
              </div>
            </div>
            <div className="preview-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmedSend}>
                Start Encrypted Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sender Local File Preview Modal (No timer!) */}
      {previewFile && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Local File Preview">
          <div className="preview-modal">
            <div className="preview-header">
              <h3><Eye size={20} /> Preview: {previewFile.name}</h3>
              <button className="preview-close" onClick={handleCloseLocalPreview} aria-label="Close preview">
                <X size={20} />
              </button>
            </div>
            <div className="preview-body">
              {previewUrl && detectFileType(previewFile.name, previewFile.type).category === 'image' && (
                <div className="local-preview-media">
                  <img src={previewUrl} alt={previewFile.name} className="preview-image" />
                </div>
              )}
              {previewUrl && detectFileType(previewFile.name, previewFile.type).category === 'video' && (
                <div className="local-preview-media">
                  <video src={previewUrl} controls autoPlay playsInline className="preview-video" />
                </div>
              )}
              {previewUrl && detectFileType(previewFile.name, previewFile.type).category === 'audio' && (
                <div className="preview-audio-wrapper">
                  <audio src={previewUrl} controls autoPlay className="preview-audio" />
                </div>
              )}
              {previewUrl && detectFileType(previewFile.name, previewFile.type).category === 'pdf' && (
                <div className="preview-pdf-wrapper">
                  <iframe src={previewUrl} title="PDF Preview" className="preview-pdf" />
                </div>
              )}
              {previewText && (
                <pre className="preview-text">{previewText}</pre>
              )}
              {!previewUrl && !previewText && (
                <div className="preview-unsupported-card">
                  <p>Binary or unsupported preview format.</p>
                  <p className="preview-size">Size: {formatBytes(previewFile.size)}</p>
                </div>
              )}
            </div>
            <div className="preview-footer">
              <button className="btn btn-secondary" onClick={handleCloseLocalPreview}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share / Result Section */}
      {result && (
        <div className="share-section animate-in">
          <h3><Shield size={22} className="share-heading-icon" /> Your Transfer Is Ready!</h3>

          <div className="status-message success">
            <Check size={18} />
            Files encrypted and uploaded. Anyone with this code can download. Keep it safe!
          </div>

          {useP2P && (
            <div className={`status-message ${p2pState === 'connected' ? 'success' : 'info'}`}>
              <Radio size={18} />
              {p2pStatus || 'Direct P2P: waiting for peer… REST share still works.'}
            </div>
          )}

          {stegoSkipped && (
            <div className="status-message info">
              <Info size={18} />
              File payload exceeded image steganography limits (&gt;10 MB), so it was encrypted directly with AES-256-GCM.
            </div>
          )}

          <div className="file-meta section-stack">
            <div className="meta-item">
              <label>Files</label>
              <span>{result.fileCount} file(s)</span>
            </div>
            <div className="meta-item">
              <label>Total Size</label>
              <span>{formatBytes(result.originalSize)}</span>
            </div>
            <div className="meta-item">
              <label>Downloads Allowed</label>
              <span>{result.maxDownloads === 0 ? 'Unlimited' : result.maxDownloads === 1 ? '1 (Burn on read)' : `${result.maxDownloads} downloads`}</span>
            </div>
            <div className="meta-item">
              <label>Expires In</label>
              <span>{formatExpiryLabel(expiryHours)}</span>
            </div>
          </div>

          {result.isBurn && (
            <div className="burn-banner">
              <Flame size={24} className="burn-icon" />
              <div>
                <strong className="burn-title">Burn-on-Read Active</strong>
                <span className="burn-copy">
                  Permanently deletes from server after the recipient downloads.
                </span>
              </div>
            </div>
          )}

          <div className="crypto-code-box">
            <label className="crypto-code-label--success"><Key size={16} /> Transfer Code</label>
            <div className="crypto-code-text">{result.transferCode}</div>
          </div>

          {shareUrl && (
            <div className="qr-code-box animate-in">
              <div className="qr-heading">
                <strong className="qr-heading-title">Scan QR Code to Download</strong>
                <span className="badge badge-primary">
                  Refreshes: {refreshCount}/{MAX_REFRESHES}
                </span>
              </div>

              <div className="qr-code-wrapper">
                <QRCodeSVG value={shareUrl} size={160} level="M" includeMargin={false} />
              </div>

              {!refreshLimitReached && (
                <button
                  onClick={refreshQRToken}
                  disabled={isRefreshingToken}
                  className="btn btn-secondary btn-sm refresh-button"
                >
                  <RefreshCw size={14} className={isRefreshingToken ? 'spin' : ''} /> Refresh QR Token
                </button>
              )}

              {refreshLimitReached && (
                <div className="limit-error">
                  QR refresh limit reached. Generate a new transfer if needed.
                </div>
              )}
            </div>
          )}

          <div className="share-actions">
            <button className="btn btn-primary btn-lg full-width" onClick={handleCopyCode}>
              {copied ? <><Check size={18} /> Code Copied!</> : <><Copy size={18} /> Copy Transfer Code</>}
            </button>
          </div>

          <button className="btn btn-secondary button-block button-block--spaced" onClick={handleClearAll}>
            <Upload size={16} /> Send Another Transfer
          </button>
          {result.ownerToken && (
            <button
              onClick={async () => {
                const ok = await cancelTransfer();
                if (ok) handleClearAll();
              }}
              className="btn btn-secondary button-block button-block-danger"
            >
              <Trash2 size={16} /> Cancel &amp; Delete This Transfer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPage;
