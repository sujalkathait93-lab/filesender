import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, File, X, Copy, Check, Shield, Lock, Key, Image as ImageIcon, Flame, Clock, ArrowLeft, Info } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { encryptFile, createTransferCode, formatBytes, copyToClipboard } from '../crypto'
import { embedPayloadInImage } from '../steganography'

function UploadPage({ serverUrl }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Vault options
  const [useSteganography, setUseSteganography] = useState(true);
  const [burnOnRead, setBurnOnRead] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);

  const fileInputRef = useRef(null);
  const API_URL = serverUrl || window.location.origin;

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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setProgress({ stage: 'reading', percent: 5 });

    try {
      const encrypted = await encryptFile(file, (p) => setProgress(p));

      let uploadBlob = encrypted.encryptedBlob;
      let uploadFileName = file.name + '.encrypted';

      if (useSteganography) {
        setProgress({ stage: 'steganography', percent: 75 });
        const payloadArrayBuffer = await encrypted.encryptedBlob.arrayBuffer();
        const payloadBytes = new Uint8Array(payloadArrayBuffer);
        uploadBlob = await embedPayloadInImage(null, payloadBytes);
        uploadFileName = 'vault_' + Date.now() + '.png';
      }

      setProgress({ stage: 'uploading', percent: 88 });

      const formData = new FormData();
      formData.append('file', uploadBlob, uploadFileName);
      formData.append('iv', encrypted.iv);
      formData.append('salt', encrypted.salt);
      formData.append('original_name', file.name);
      formData.append('original_size', encrypted.originalSize);
      formData.append('compressed', '1');
      formData.append('max_downloads', burnOnRead ? '1' : '10');
      formData.append('burn_on_read', burnOnRead ? '1' : '0');
      formData.append('expiry_hours', expiryHours.toString());

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

      setProgress({ stage: 'complete', percent: 100 });
      setResult({
        fileId: data.file_id,
        transferCode,
        expiresAt: data.expires_at,
        originalSize: encrypted.originalSize,
        isBurn: burnOnRead
      });
    } catch (err) {
      setError(err.message || 'Something went wrong while uploading. Please try again.');
      setProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    await copyToClipboard(result.transferCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setShareUrl('');
    setError(null);
    setProgress(null);
    setIsProcessing(false);
    setCopied(false);
  };

  const getStageLabel = (stage) => {
    const labels = {
      reading: 'Reading file...',
      compressing: 'Compressing file...',
      encrypting: 'Encrypting with AES-256-GCM...',
      encrypted: 'Encryption complete',
      steganography: 'Hiding encrypted data inside an image...',
      uploading: 'Uploading encrypted file...',
      complete: 'Done!'
    };
    return labels[stage] || stage;
  };

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Upload /> Send a File</h2>
        <p>Pick a file, get a code, and share it. That is all there is to it.</p>
      </div>

      <div className="wizard-steps">
        <div className={`step ${!file && !result ? 'active' : 'completed'}`}>
          <span className="step-num">1</span>
          <span className="step-label">Choose File</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${file && !result ? 'active' : result ? 'completed' : ''}`}>
          <span className="step-num">2</span>
          <span className="step-label">Send</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${result ? 'active completed' : ''}`}>
          <span className="step-num">3</span>
          <span className="step-label">Share the Code</span>
        </div>
      </div>

      {!result && (
        <>
          <div
            className={`drop-zone ${file ? 'file-selected' : ''} ${isDragging ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="drop-icon-wrapper">
              <Upload size={32} />
            </div>
            <h3>{file ? `Selected: ${file.name}` : 'Drop your file here, or click to browse'}</h3>
            <p>
              {file
                ? `${formatBytes(file.size)} - click to choose a different file`
                : 'Any file type, up to 2GB'}
            </p>
            <input ref={fileInputRef} type="file" className="file-input" onChange={handleFileSelect} />
          </div>

          {file && (
            <div className="file-info animate-in">
              <div className="file-info-header">
                <div className="file-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                  <File size={24} />
                </div>
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{formatBytes(file.size)} • {file.type || 'File'}</p>
                </div>
                <button className="btn btn-secondary" onClick={clearFile} aria-label="Remove file" style={{ marginLeft: 'auto' }}>
                  <X size={16} />
                </button>
              </div>

              <div className="vault-settings">
                <h5 className="section-subtitle">Options (optional)</h5>

                <div className={`vault-option-card ${burnOnRead ? 'active' : ''}`} onClick={() => setBurnOnRead(!burnOnRead)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setBurnOnRead(!burnOnRead)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Flame size={20} style={{ color: burnOnRead ? '#ef4444' : '#aaa' }} />
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>Burn-on-Read</strong>
                        <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--foreground-muted)' }}>
                          The file is deleted from the server as soon as it is downloaded.
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
                        <strong style={{ fontSize: '0.95rem' }}>Hide inside an image</strong>
                        <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--foreground-muted)' }}>
                          Disguises your transfer as a normal photo. Recommended - keep it on.
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
                    <option value={168}>7 days</option>
                  </select>
                </div>
              </div>

              {progress && (
                <div className="progress-container">
                  <div className="progress-bar">
                    <div className="progress-fill green-fill" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="progress-text">
                    <span>{getStageLabel(progress.stage)}</span>
                    <span>{progress.percent}%</span>
                  </div>
                </div>
              )}

              <div className="action-row" style={{ marginTop: '1.25rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSend}
                  disabled={isProcessing}
                  style={{ flex: 1 }}
                >
                  {isProcessing ? <><Lock size={18} /> Working...</> : <><Lock size={18} /> Encrypt & Get Code</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="status-message error" style={{ marginTop: '1.25rem' }}>
          <X size={18} /> {error}
        </div>
      )}

      {result && (
        <div className="share-section animate-in">
          <h3><Shield size={20} style={{ color: '#10b981' }} /> Your file is ready!</h3>

          <div className="status-message success">
            <Check size={18} />
            Your file was encrypted and securely stored. Send the code below to the recipient.
          </div>

          <div className="file-meta" style={{ marginTop: '1rem' }}>
            <div className="meta-item">
              <label>File Name</label>
              <span>{file?.name}</span>
            </div>
            <div className="meta-item">
              <label>Size</label>
              <span>{formatBytes(result.originalSize)}</span>
            </div>
            <div className="meta-item">
              <label>Expires</label>
              <span>{new Date(result.expiresAt).toLocaleString()}</span>
            </div>
          </div>

          {result.isBurn && (
            <div className="burn-banner">
              <Flame size={24} style={{ color: '#ef4444' }} />
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: '#fca5a5' }}>Burn-on-Read Active</strong>
                <span style={{ fontSize: '0.82rem', color: 'rgba(254, 202, 202, 0.8)' }}>
                  The file will self-destruct from the server after the first download.
                </span>
              </div>
            </div>
          )}

          <div className="crypto-code-box" style={{ borderColor: '#10b981', marginTop: '1.25rem' }}>
            <label style={{ color: '#10b981' }}><Key size={16} /> Share Code</label>
            <div className="crypto-code-text">{result.transferCode}</div>
            <p className="hint-text">The recipient enters this code on the Receive page. The code contains the decryption key, so share it safely.</p>
          </div>

          {shareUrl && (
            <div className="qr-code-box animate-in">
              <strong style={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>Scan to Download on Mobile</strong>
              <div className="qr-code-wrapper">
                <QRCodeSVG value={shareUrl} size={150} level="M" includeMargin={false} />
              </div>
              <span className="hint-text" style={{ margin: 0 }}>Scan this code with your phone to auto-fill the code and decrypt the file instantly.</span>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleCopy} style={{ width: '100%', justifyContent: 'center' }}>
            {copied ? <><Check size={18} /> Copied!</> : <><Copy size={18} /> Copy Code</>}
          </button>

          <button className="btn btn-secondary" onClick={clearFile} style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}>
            Send Another File
          </button>
        </div>
      )}

      {!file && !result && (
        <div className="security-notice">
          <Info size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Your file is encrypted in your browser with AES-256-GCM before upload. The server never sees the
          decryption key, so even it cannot read your file.
        </div>
      )}
    </div>
  );
}

export default UploadPage