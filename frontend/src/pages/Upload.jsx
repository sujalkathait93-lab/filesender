import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, File, X, Copy, Check, Shield, Lock, Key, Image as ImageIcon, Flame, Clock, ArrowLeft, Info, RefreshCw, AlertTriangle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { encryptFile, createTransferCode, formatBytes, copyToClipboard } from '../crypto'
import { embedPayloadInImage } from '../steganography'
import { TransferStateMachine, TransferState } from '../stateMachine'
import { validateFilesTotalSize, MAX_TOTAL_TRANSFER_SIZE } from '../chunkManager'

// Steganography maximum single-image payload threshold (~10 MB)
const STEGO_MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REFRESHES = 5;

function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [stateMachine] = useState(() => new TransferStateMachine(TransferState.IDLE));
  const [currentState, setCurrentState] = useState(TransferState.IDLE);
  const [statusMessage, setStatusMessage] = useState('Ready');
  
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [stegoSkipped, setStegoSkipped] = useState(false);

  // Pre-Transfer Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Vault Options
  const [useSteganography, setUseSteganography] = useState(true);
  const [burnOnRead, setBurnOnRead] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);

  // QR Code & Token Lifecycle State
  const [refreshCount, setRefreshCount] = useState(0);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [refreshLimitReached, setRefreshLimitReached] = useState(false);

  const fileInputRef = useRef(null);
  const API_URL = window.location.origin;

  // Safe browser capability detection
  const supportsMultiple = typeof document !== 'undefined' && 'multiple' in document.createElement('input');

  useEffect(() => {
    stateMachine.onStateChange = ({ currentState, userMessage }) => {
      setCurrentState(currentState);
      setStatusMessage(userMessage);
    };
  }, [stateMachine]);

  const calculateTotalSize = (fileList = files) => {
    return fileList.reduce((acc, f) => acc + (f.size || 0), 0);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length === 0) return;

    addFiles(droppedFiles);
  }, [files]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    e.target.value = '';
  };

  const addFiles = (newFiles) => {
    const combined = [...files, ...newFiles];
    const validation = validateFilesTotalSize(combined);

    if (!validation.valid) {
      setError(validation.error);
      stateMachine.transitionTo(TransferState.SELECTING);
      return;
    }

    setError(null);
    setFiles(combined);
    setResult(null);
    setStegoSkipped(false);
    stateMachine.transitionTo(TransferState.SELECTING);
  };

  const removeFile = (indexToRemove) => {
    const updated = files.filter((_, idx) => idx !== indexToRemove);
    setFiles(updated);
    if (updated.length === 0) {
      setError(null);
      stateMachine.transitionTo(TransferState.IDLE);
    } else {
      const validation = validateFilesTotalSize(updated);
      if (!validation.valid) setError(validation.error);
      else setError(null);
    }
  };

  const openConfirmation = () => {
    if (files.length === 0) return;
    const validation = validateFilesTotalSize(files);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError(null);
    stateMachine.transitionTo(TransferState.VALIDATING);
    setShowConfirmModal(true);
  };

  const handleConfirmedSend = async () => {
    setShowConfirmModal(false);
    if (files.length === 0) return;

    stateMachine.transitionTo(TransferState.PREPARING);
    setError(null);
    setProgress({ stage: 'reading', percent: 5 });

    try {
      stateMachine.transitionTo(TransferState.PROCESSING);

      // Process main file (or first file in multi-file collection)
      const primaryFile = files[0];
      const encrypted = await encryptFile(primaryFile, (p) => setProgress(p));

      let uploadBlob = encrypted.encryptedBlob;
      let uploadFileName = primaryFile.name + '.encrypted';

      if (useSteganography) {
        setProgress({ stage: 'steganography', percent: 75 });
        if (encrypted.encryptedSize > STEGO_MAX_PAYLOAD_BYTES) {
          setStegoSkipped(true);
        } else {
          try {
            const payloadArrayBuffer = await encrypted.encryptedBlob.arrayBuffer();
            const payloadBytes = new Uint8Array(payloadArrayBuffer);
            uploadBlob = await embedPayloadInImage(null, payloadBytes);
            uploadFileName = 'vault_' + Date.now() + '.png';
          } catch (stegoErr) {
            console.warn('Steganography skipped:', stegoErr.message);
            setStegoSkipped(true);
          }
        }
      }

      stateMachine.transitionTo(TransferState.CREATING_TRANSFER);
      setProgress({ stage: 'uploading', percent: 88 });

      const formData = new FormData();
      formData.append('file', uploadBlob, uploadFileName);
      formData.append('iv', encrypted.iv);
      formData.append('salt', encrypted.salt);
      formData.append('original_name', primaryFile.name);
      formData.append('original_size', encrypted.originalSize);
      formData.append('compressed', '1');
      formData.append('max_downloads', burnOnRead ? '1' : '10');
      formData.append('burn_on_read', burnOnRead ? '1' : '0');
      formData.append('expiry_hours', expiryHours.toString());
      formData.append('sharing_mode', useSteganography && burnOnRead ? 'both' : useSteganography ? 'steganography' : burnOnRead ? 'burn_on_read' : 'standard');

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errMsg = 'Upload failed. Please try again.';
        try {
          const errJson = await response.json();
          if (errJson.detail) errMsg = typeof errJson.detail === 'string' ? errJson.detail : errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      const transferCode = createTransferCode(data.file_id, encrypted.password);

      let bestUrl = `${window.location.origin}/download?code=${encodeURIComponent(transferCode)}`;
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        try {
          const netInfoRes = await fetch(`${API_URL}/api/network-info`);
          if (netInfoRes.ok) {
            const netData = await netInfoRes.json();
            const lanIp = (netData.local_ips || []).find(ip => ip !== '127.0.0.1' && !ip.startsWith('127.'));
            if (lanIp) {
              bestUrl = `http://${lanIp}:5173/download?code=${encodeURIComponent(transferCode)}`;
            }
          }
        } catch (e) {
          console.warn("Failed to fetch network info for LAN sharing URL:", e);
        }
      }

      setShareUrl(bestUrl);
      setRefreshCount(0);
      setRefreshLimitReached(false);
      stateMachine.transitionTo(TransferState.WAITING_FOR_RECEIVER);
      setProgress({ stage: 'complete', percent: 100 });

      setResult({
        fileId: data.file_id,
        transferId: data.transfer_id || data.file_id,
        transferCode,
        expiresAt: data.expires_at,
        originalSize: calculateTotalSize(),
        fileCount: files.length,
        isBurn: burnOnRead
      });
    } catch (err) {
      setError(err.message || 'Something went wrong while uploading. Please try again.');
      stateMachine.transitionTo(TransferState.FAILED);
      setProgress(null);
    }
  };

  const handleManualRefreshQR = async () => {
    if (!result || isRefreshingToken || refreshLimitReached) return;

    if (refreshCount >= MAX_REFRESHES) {
      setRefreshLimitReached(true);
      setError("QR refresh limit reached. Generate a new transfer.");
      return;
    }

    setIsRefreshingToken(true);
    try {
      const res = await fetch(`${API_URL}/api/transfers/${result.transferId}/token/refresh`, {
        method: 'POST'
      });
      if (res.status === 429) {
        setRefreshLimitReached(true);
        setError("QR refresh limit reached. Generate a new transfer.");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setRefreshCount(data.refresh_count);
        if (data.refresh_count >= MAX_REFRESHES) {
          setRefreshLimitReached(true);
        }
      }
    } catch (err) {
      console.warn("QR refresh network error:", err);
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await copyToClipboard(result.transferCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearFiles = () => {
    setFiles([]);
    setResult(null);
    setShareUrl('');
    setError(null);
    setProgress(null);
    setCopied(false);
    setStegoSkipped(false);
    setRefreshCount(0);
    setRefreshLimitReached(false);
    stateMachine.transitionTo(TransferState.IDLE);
  };

  const totalSelectedSize = calculateTotalSize();
  const remainingCapacity = Math.max(0, MAX_TOTAL_TRANSFER_SIZE - totalSelectedSize);
  const isOverLimit = totalSelectedSize > MAX_TOTAL_TRANSFER_SIZE;

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Upload /> Send Files</h2>
        <p>Pick single or multiple files (up to 2 GB total). Encrypted end-to-end in your browser.</p>
      </div>

      <div className="wizard-steps">
        <div className={`step ${files.length === 0 && !result ? 'active' : 'completed'}`}>
          <span className="step-num">1</span>
          <span className="step-label">Select Files</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${files.length > 0 && !result ? 'active' : result ? 'completed' : ''}`}>
          <span className="step-num">2</span>
          <span className="step-label">Options & Send</span>
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
          >
            <div className="drop-icon-wrapper">
              <Upload size={32} />
            </div>
            <h3>{files.length > 0 ? `${files.length} file(s) selected` : 'Tap to select or drop files here'}</h3>
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
            />
          </div>

          {files.length > 0 && (
            <div className="file-info animate-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  Selected Files ({files.length})
                </h4>
                <button className="btn btn-secondary" onClick={clearFiles} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  Clear All
                </button>
              </div>

              <div className="selected-files-list">
                {files.map((f, idx) => (
                  <div key={idx} className="file-info-header" style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: '10px' }}>
                    <div className="file-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', width: 36, height: 36 }}>
                      <File size={18} />
                    </div>
                    <div className="file-details" style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.9rem' }}>{f.name}</h4>
                      <p>{formatBytes(f.size)} • {f.type || 'File'}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => removeFile(idx)} aria-label="Remove file" style={{ padding: '0.4rem' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="capacity-bar-container" style={{ margin: '1.25rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '0.35rem' }}>
                  <span>Total Selected: {formatBytes(totalSelectedSize)}</span>
                  <span>Max Limit: 2 GB</span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${isOverLimit ? 'error-fill' : 'green-fill'}`}
                    style={{ width: `${Math.min(100, (totalSelectedSize / MAX_TOTAL_TRANSFER_SIZE) * 100)}%`, background: isOverLimit ? 'var(--error)' : undefined }}
                  />
                </div>
              </div>

              <div className="vault-settings">
                <h5 className="section-subtitle">Sharing Options</h5>

                <div className={`vault-option-card ${burnOnRead ? 'active' : ''}`} onClick={() => setBurnOnRead(!burnOnRead)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setBurnOnRead(!burnOnRead)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Flame size={20} style={{ color: burnOnRead ? '#ef4444' : '#aaa' }} />
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>Burn-on-Read</strong>
                        <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--foreground-muted)' }}>
                          File is permanently deleted from the server immediately after download.
                        </span>
                      </div>
                    </div>
                    <input type="checkbox" checked={burnOnRead} onChange={(e) => setBurnOnRead(e.target.checked)} style={{ accentColor: '#ef4444' }} aria-label="Burn on read" />
                  </div>
                </div>

                <div className={`vault-option-card ${useSteganography ? 'active' : ''}`} onClick={() => setUseSteganography(!useSteganography)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setUseSteganography(!useSteganography)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <ImageIcon size={20} style={{ color: useSteganography ? '#10b981' : '#aaa' }} />
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>Image/Steganography Disguise</strong>
                        <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--foreground-muted)' }}>
                          Disguises transfer payload inside cover photo pixels.
                        </span>
                      </div>
                    </div>
                    <input type="checkbox" checked={useSteganography} onChange={(e) => setUseSteganography(e.target.checked)} style={{ accentColor: '#10b981' }} aria-label="Hide inside an image" />
                  </div>
                </div>

                <div className="expiry-row">
                  <Clock size={18} style={{ color: 'var(--foreground-muted)' }} />
                  <label htmlFor="expiry-select">Code expires after</label>
                  <select
                    id="expiry-select"
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(Number(e.target.value))}
                  >
                    <option value={1}>1 hour</option>
                    <option value={4}>4 hours</option>
                    <option value={24}>1 day</option>
                    <option value={72}>3 days</option>
                  </select>
                </div>
              </div>

              {progress && (
                <div className="progress-container">
                  <div className="progress-bar">
                    <div className="progress-fill green-fill" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="progress-text">
                    <span>{statusMessage}</span>
                    <span>{progress.percent}%</span>
                  </div>
                </div>
              )}

              <div className="action-row" style={{ marginTop: '1.25rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={openConfirmation}
                  disabled={currentState !== TransferState.IDLE && currentState !== TransferState.SELECTING && currentState !== TransferState.VALIDATING}
                  style={{ flex: 1, minHeight: '48px' }}
                >
                  <Lock size={18} /> Review & Confirm Transfer
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="status-message error" style={{ marginTop: '1.25rem' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Pre-Transfer Confirmation Modal */}
      {showConfirmModal && (
        <div className="preview-overlay">
          <div className="preview-modal" style={{ maxWidth: '550px' }}>
            <div className="preview-header">
              <h3><Shield size={20} /> Confirm Transfer Details</h3>
              <button className="preview-close" onClick={() => setShowConfirmModal(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>
            <div className="preview-body">
              <div className="security-notice" style={{ marginBottom: '1rem' }}>
                Please review your selected files and security settings before starting the encrypted transfer.
              </div>

              <div className="meta-item" style={{ marginBottom: '0.75rem' }}>
                <label>Selected Files</label>
                <span>{files.length} file(s) ({files.map(f => f.name).join(', ')})</span>
              </div>
              <div className="meta-item" style={{ marginBottom: '0.75rem' }}>
                <label>Total Size</label>
                <span>{formatBytes(totalSelectedSize)}</span>
              </div>
              <div className="meta-item" style={{ marginBottom: '0.75rem' }}>
                <label>Sharing Mode</label>
                <span style={{ color: '#10b981' }}>
                  {useSteganography && burnOnRead ? 'Burn-on-Read + Steganography' : useSteganography ? 'Image/Steganography' : burnOnRead ? 'Burn-on-Read' : 'Standard AES-256-GCM'}
                </span>
              </div>
              <div className="meta-item">
                <label>Code Expiry</label>
                <span>{expiryHours} hour(s)</span>
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

      {result && (
        <div className="share-section animate-in">
          <h3><Shield size={20} style={{ color: '#10b981' }} /> Your transfer is ready!</h3>

          <div className="status-message success">
            <Check size={18} />
            Files encrypted and securely prepared. Share the code below with the recipient.
          </div>

          {stegoSkipped && (
            <div className="status-message info">
              <Info size={18} />
              File payload exceeded image steganography limits (&gt;10 MB), so it was encrypted directly with AES-256-GCM.
            </div>
          )}

          <div className="file-meta" style={{ marginTop: '1rem' }}>
            <div className="meta-item">
              <label>Files</label>
              <span>{result.fileCount} file(s)</span>
            </div>
            <div className="meta-item">
              <label>Total Size</label>
              <span>{formatBytes(result.originalSize)}</span>
            </div>
            <div className="meta-item">
              <label>Expires</label>
              <span>{new Date(result.expiresAt).toLocaleTimeString()}</span>
            </div>
          </div>

          {result.isBurn && (
            <div className="burn-banner">
              <Flame size={24} style={{ color: '#ef4444' }} />
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: '#fca5a5' }}>Burn-on-Read Active</strong>
                <span style={{ fontSize: '0.82rem', color: 'rgba(254, 202, 202, 0.8)' }}>
                  Permanently deletes from server after the recipient downloads.
                </span>
              </div>
            </div>
          )}

          <div className="crypto-code-box" style={{ borderColor: '#10b981', marginTop: '1.25rem' }}>
            <label style={{ color: '#10b981' }}><Key size={16} /> Share Code</label>
            <div className="crypto-code-text">{result.transferCode}</div>
          </div>

          {shareUrl && (
            <div className="qr-code-box animate-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>Scan Code to Download</strong>
                <span className="badge" style={{ background: refreshLimitReached ? 'rgba(239, 68, 68, 0.2)' : undefined, color: refreshLimitReached ? '#ef4444' : undefined }}>
                  Refreshes: {refreshCount}/{MAX_REFRESHES}
                </span>
              </div>

              <div className="qr-code-wrapper">
                <QRCodeSVG value={shareUrl} size={160} level="M" includeMargin={false} />
              </div>

              {!refreshLimitReached && (
                <button
                  className="btn btn-secondary"
                  onClick={handleManualRefreshQR}
                  disabled={isRefreshingToken}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.4rem' }}
                >
                  <RefreshCw size={14} className={isRefreshingToken ? 'spin' : ''} /> Refresh Token
                </button>
              )}

              {refreshLimitReached && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}>
                  QR refresh limit reached. Generate a new transfer.
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleCopy} style={{ width: '100%', justifyContent: 'center', minHeight: '48px' }}>
            {copied ? <><Check size={18} /> Copied!</> : <><Copy size={18} /> Copy Code</>}
          </button>

          <button className="btn btn-secondary" onClick={clearFiles} style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem', minHeight: '48px' }}>
            Send Another Transfer
          </button>
        </div>
      )}

      {files.length === 0 && !result && (
        <div className="security-notice">
          <Info size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Zero-knowledge client-side encryption. Keys are never transmitted to or stored on the server.
        </div>
      )}
    </div>
  );
}

export default UploadPage