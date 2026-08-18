import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, File, X, Copy, Check, Shield, Lock, Key,
  Image as ImageIcon, Flame, Clock, ArrowLeft, Info,
  RefreshCw, Loader2, Users, Radio, Eye, Trash2,
  FileText, Video, Music, FileCode, ShieldCheck, Sparkles, QrCode, HelpCircle,
  Archive, Package
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatBytes, copyToClipboard } from '../crypto'
import { TransferStateMachine, TransferState } from '../stateMachine'
import { MAX_TOTAL_TRANSFER_SIZE, detectFileType } from '../fileManager'
import { useFileUpload } from '../hooks/useFileUpload'
import { useEncryptAndSend } from '../hooks/useEncryptAndSend'
import { useP2PSession } from '../hooks/useP2PSession'
import { MeasurableProgressBar, ErrorAlert } from '../components/FeedbackStates'

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
    case 'archive': return <Archive size={18} />;
    case 'document': return <FileText size={18} />;
    case 'app': return <Package size={18} />;
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
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Sender File Preview State
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
      <button className="btn btn-secondary btn-sm back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={15} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Upload size={22} /> Send Files</h2>
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
              <Upload size={26} />
            </div>
            <h3>{files.length > 0 ? `${files.length} file(s) selected` : 'Choose files or drag here'}</h3>
            <p>
              {files.length > 0
                ? `${formatBytes(totalSelectedSize)} selected • ${formatBytes(remainingCapacity)} remaining`
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
                      <div style={{ minWidth: 0 }}>
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
                        <Eye size={13} /> Preview
                      </button>
                      <button
                        className="file-remove-btn"
                        onClick={() => removeFile(idx)}
                        disabled={isTransferring}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="capacity-bar-container">
                <div className="capacity-labels">
                  <span>Total: {formatBytes(totalSelectedSize)}</span>
                  <span>Max: 2 GB</span>
                </div>
                <progress
                  className={`capacity-progress ${isOverLimit ? 'capacity-progress--error' : ''}`}
                  value={totalSelectedSize}
                  max={MAX_TOTAL_TRANSFER_SIZE}
                  aria-label="Selected file size relative to the 2 GB limit"
                />
              </div>

              {/* Enhanced Sharing Options */}
              <div className="vault-settings">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h4 className="settings-heading" style={{ marginBottom: 0 }}>
                    Sharing &amp; Privacy Options
                  </h4>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowGuideModal(true)}
                    style={{ fontSize: '0.775rem', gap: 4 }}
                  >
                    <HelpCircle size={14} /> Feature Guide
                  </button>
                </div>

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
                        <Flame size={18} />
                      </div>
                      <div>
                        <div className="option-card__title-row">
                          <strong className="option-card__title">Burn-on-Read (Self-Destruct)</strong>
                          <span className="badge badge-amber">ONE-TIME USE</span>
                        </div>
                        <span className="option-card__description">
                          Permanently deletes payload from the server immediately after the first recipient downloads.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={burnOnRead}
                      disabled={isTransferring}
                      onChange={(e) => { e.stopPropagation(); handleBurnToggle(); }}
                      className="option-checkbox"
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
                        <ImageIcon size={18} />
                      </div>
                      <div>
                        <div className="option-card__title-row">
                          <strong className="option-card__title">Steganography Image Vault</strong>
                          <span className="badge badge-emerald">STEALTH &lt;10MB</span>
                        </div>
                        <span className="option-card__description">
                          Conceals encrypted payload bytes inside standard PNG pixels to bypass inspection filters.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useSteganography}
                      disabled={isTransferring}
                      onChange={(e) => { e.stopPropagation(); setUseSteganography(e.target.checked); }}
                      className="option-checkbox"
                      aria-label="Steganography mode"
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
                        <Radio size={18} />
                      </div>
                      <div>
                        <div className="option-card__title-row">
                          <strong className="option-card__title">Direct P2P Transfer (WebRTC)</strong>
                          <span className="badge badge-primary">FAST STREAM &gt;500MB</span>
                        </div>
                        <span className="option-card__description">
                          Streams directly peer-to-peer between devices without storing files on intermediary servers.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useP2P}
                      disabled={isTransferring}
                      onChange={(e) => { e.stopPropagation(); setUseP2P(e.target.checked); }}
                      className="option-checkbox"
                      aria-label="Direct P2P transfer"
                    />
                  </div>
                </div>

                {/* Download limit selection */}
                <div className="expiry-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={16} className="field-icon" />
                    <label htmlFor="downloads-select">Download Limit</label>
                  </div>
                  <select
                    id="downloads-select"
                    value={maxDownloads}
                    disabled={isTransferring}
                    onChange={(e) => handleMaxDownloadsChange(e.target.value)}
                  >
                    <option value={0}>Unlimited (until expiry)</option>
                    <option value={1}>1 download (Burn-on-Read)</option>
                    <option value={5}>5 downloads</option>
                    <option value={10}>10 downloads (Standard)</option>
                    <option value={20}>20 downloads</option>
                    <option value={50}>50 downloads</option>
                    <option value={100}>100 downloads</option>
                  </select>
                </div>

                {/* Expiry selection */}
                <div className="expiry-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={16} className="field-icon" />
                    <label htmlFor="expiry-select">Code Expiry (TTL)</label>
                  </div>
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

              {/* Progress Bar during Transfer */}
              {progress && (
                <div style={{ marginBottom: 16 }}>
                  <MeasurableProgressBar
                    stage={progress.stage}
                    percent={progress.percent}
                    statusMessage={statusMessage}
                  />
                </div>
              )}

              <div style={{ marginTop: 20 }}>
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
        <div style={{ marginBottom: 16 }}>
          <ErrorAlert
            message={error}
            actionText={isOverLimit ? 'Clear Files' : 'Retry'}
            onAction={isOverLimit ? handleClearAll : openConfirmation}
          />
        </div>
      )}

      {/* Pre-Transfer Confirmation Modal (Platform-Aware Sheet/Dialog) */}
      {showConfirmModal && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Confirm Transfer Details">
          <div className="preview-modal modal-narrow">
            <div className="preview-header">
              <h3><Shield size={18} /> Confirm Transfer</h3>
              <button className="preview-close" onClick={() => setShowConfirmModal(false)} aria-label="Close modal" ref={confirmCloseRef}>
                <X size={18} />
              </button>
            </div>
            <div className="preview-body">
              <div className="confirmation-notice">
                Please review your selected files and security settings before starting the browser-encrypted upload.
              </div>

              <div className="confirmation-row">
                <label>Files</label>
                <span className="word-break">{files.length} file(s) ({files.map(f => f.name).join(', ')})</span>
              </div>
              <div className="confirmation-row">
                <label>Total Size</label>
                <span>{formatBytes(totalSelectedSize)}</span>
              </div>
              <div className="confirmation-row">
                <label>Sharing Mode</label>
                <span>
                  {useSteganography && burnOnRead ? 'Burn-on-Read + Steganography' : useSteganography ? 'Steganography Vault' : burnOnRead ? 'Burn-on-Read' : 'Standard AES-256-GCM'}
                </span>
              </div>
              <div className="confirmation-row">
                <label>Download Limit</label>
                <span>
                  {maxDownloads === 0 ? 'Unlimited' : maxDownloads === 1 ? '1 download (Burn-on-Read)' : `${maxDownloads} downloads`}
                </span>
              </div>
              <div className="confirmation-row" style={{ borderBottom: 'none' }}>
                <label>Code Expiry</label>
                <span>{formatExpiryLabel(expiryHours)}</span>
              </div>
            </div>
            <div className="preview-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirmedSend}>
                Start Encrypted Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sender Local File Preview Modal */}
      {previewFile && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Local File Preview">
          <div className="preview-modal">
            <div className="preview-header">
              <h3><Eye size={18} /> Preview: {previewFile.name}</h3>
              <button className="preview-close" onClick={handleCloseLocalPreview} aria-label="Close preview">
                <X size={18} />
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
              {!previewUrl && !previewText && (() => {
                const det = detectFileType(previewFile.name, previewFile.type);
                return (
                  <div className="preview-unsupported-card">
                    <div className="file-icon" style={{ margin: '0 auto 12px auto', width: 44, height: 44 }}>
                      {getFileIcon(previewFile.name, previewFile.type)}
                    </div>
                    <h4>{previewFile.name}</h4>
                    <div style={{ margin: '8px 0' }}>
                      <span className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                        {det.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', maxWidth: 440, margin: '8px auto' }}>
                      {det.description || 'This file cannot be rendered inside the web browser. The recipient will download and open it directly on their device.'}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--fg-subtle)', marginTop: 8 }}>
                      Total Size: {formatBytes(previewFile.size)} • Memory Verified
                    </p>
                  </div>
                );
              })()}
            </div>
            <div className="preview-footer">
              <button className="btn btn-secondary btn-sm" onClick={handleCloseLocalPreview}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Feature & Privacy Guide Modal */}
      {showGuideModal && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Feature & Privacy Guide">
          <div className="preview-modal">
            <div className="preview-header">
              <h3><HelpCircle size={18} /> Feature &amp; Privacy Guide</h3>
              <button className="preview-close" onClick={() => setShowGuideModal(false)} aria-label="Close guide">
                <X size={18} />
              </button>
            </div>
            <div className="preview-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Flame size={18} style={{ color: 'var(--warning-fg)' }} />
                  <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>Burn-on-Read (Self-Destruct)</strong>
                  <span className="badge badge-amber">One-Time</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  <strong>How it works:</strong> The moment the recipient finishes downloading, the file is automatically and permanently purged from the server memory and disk.
                  <br /><strong>When to use:</strong> Highly confidential one-time files like password exports, ID scans, bank statements, or salary slips.
                </p>
              </div>

              <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <ImageIcon size={18} style={{ color: 'var(--success-fg)' }} />
                  <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>Steganography Image Vault</strong>
                  <span className="badge badge-emerald">&lt;10 MB</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  <strong>How it works:</strong> Injects the encrypted file bytes into the least-significant bits (LSB) of innocent-looking PNG image pixels. The resulting image looks normal to any observer or network scanner.
                  <br /><strong>When to use:</strong> Sensitive text keys, small documents, or files that need to bypass strict network DPI firewalls.
                </p>
              </div>

              <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Radio size={18} style={{ color: 'var(--accent)' }} />
                  <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>Direct P2P Transfer (WebRTC)</strong>
                  <span className="badge badge-primary">&gt;500 MB</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  <strong>How it works:</strong> Establishes a direct peer-to-peer browser data channel between sender and recipient. No files are uploaded to or stored on our servers.
                  <br /><strong>When to use:</strong> Large video files, archives, and datasets where sender and receiver are online at the same time.
                </p>
              </div>

              <div style={{ padding: 12, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Clock size={18} style={{ color: 'var(--fg-default)' }} />
                  <strong style={{ color: 'var(--fg-default)', fontSize: '0.9rem' }}>TTL Expiry &amp; Download Limits</strong>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  Set expiration timers (15 to 60 minutes) and download limits (1 to 100 downloads). When either threshold is reached, access is automatically revoked.
                </p>
              </div>
            </div>
            <div className="preview-footer">
              <button className="btn btn-primary btn-sm" onClick={() => setShowGuideModal(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share / Result Section */}
      {result && (
        <div className="share-section animate-in">
          <h3><Shield size={20} className="share-heading-icon" /> Transfer Encrypted &amp; Ready</h3>

          <div className="status-message success">
            <Check size={16} />
            <span>Files encrypted and ready. Anyone with this code can download. Keep it safe!</span>
          </div>

          {useP2P && (
            <div className={`status-message ${p2pState === 'connected' ? 'success' : 'info'}`}>
              <Radio size={16} />
              <span>{p2pStatus || 'Direct P2P: waiting for peer… REST share still active.'}</span>
            </div>
          )}

          {stegoSkipped && (
            <div className="status-message info">
              <Info size={16} />
              <span>Payload exceeded image steganography limits (&gt;10 MB), encrypted directly with AES-256-GCM.</span>
            </div>
          )}

          <div className="file-meta">
            <div className="meta-item">
              <label>Files</label>
              <span>{result.fileCount} file(s)</span>
            </div>
            <div className="meta-item">
              <label>Total Size</label>
              <span>{formatBytes(result.originalSize)}</span>
            </div>
            <div className="meta-item">
              <label>Downloads</label>
              <span>{result.maxDownloads === 0 ? 'Unlimited' : result.maxDownloads === 1 ? '1 (Burn on read)' : `${result.maxDownloads} downloads`}</span>
            </div>
            <div className="meta-item">
              <label>Expires In</label>
              <span>{formatExpiryLabel(expiryHours)}</span>
            </div>
          </div>

          {result.isBurn && (
            <div className="burn-banner">
              <Flame size={20} className="burn-icon" />
              <div>
                <strong className="burn-title">Burn-on-Read Active</strong>
                <span className="burn-copy">
                  Permanently deletes from server immediately after the recipient downloads.
                </span>
              </div>
            </div>
          )}

          <div className="crypto-code-box">
            <label className="crypto-code-label--success"><Key size={14} /> Transfer Code</label>
            <div className="crypto-code-text">{result.transferCode}</div>
          </div>

          {shareUrl && (
            <div className="qr-code-box animate-in">
              <div className="qr-heading">
                <strong className="qr-heading-title">Scan QR Code to Download</strong>
                <span className="badge badge-primary">
                  Tokens: {refreshCount}/{MAX_REFRESHES}
                </span>
              </div>

              <div className="qr-code-wrapper">
                <QRCodeSVG value={shareUrl} size={150} level="M" includeMargin={false} />
              </div>

              <div>
                {!refreshLimitReached && (
                  <button
                    onClick={refreshQRToken}
                    disabled={isRefreshingToken}
                    className="btn btn-secondary btn-sm refresh-button"
                  >
                    <RefreshCw size={13} className={isRefreshingToken ? 'spin' : ''} /> Refresh QR Token
                  </button>
                )}

                {refreshLimitReached && (
                  <div className="limit-error">
                    QR token refresh limit reached (5/5).
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="share-actions">
            <button className="btn btn-primary btn-lg full-width" onClick={handleCopyCode}>
              {copied ? <><Check size={18} /> Code Copied to Clipboard!</> : <><Copy size={18} /> Copy Transfer Code</>}
            </button>
          </div>

          <button className="btn btn-secondary button-block" onClick={handleClearAll}>
            <Upload size={15} /> Send Another Transfer
          </button>
          {result.ownerToken && (
            <button
              onClick={async () => {
                const ok = await cancelTransfer();
                if (ok) handleClearAll();
              }}
              className="btn btn-secondary button-block button-block-danger"
            >
              <Trash2 size={15} /> Cancel &amp; Delete This Transfer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPage;
