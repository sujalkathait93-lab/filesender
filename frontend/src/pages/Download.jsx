import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, Lock, Shield, AlertTriangle, Check, Key, Flame, Eye, X, ArrowLeft, FileText, Info, Copy, Clock } from 'lucide-react'
import { decryptFile, extractKeyFromUrl, parseTransferCode, formatBytes } from '../crypto'
import { extractPayloadFromImage } from '../steganography'
import { TransferStateMachine, TransferState } from '../stateMachine'

function DownloadPage() {
  const { fileId: urlFileId } = useParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState(urlFileId || '');
  const [fileInfo, setFileInfo] = useState(null);
  const [stateMachine] = useState(() => new TransferStateMachine(TransferState.IDLE));
  const [currentState, setCurrentState] = useState(TransferState.IDLE);
  const [statusMessage, setStatusMessage] = useState('Ready');

  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isBurned, setIsBurned] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const [decryptedBlobUrl, setDecryptedBlobUrl] = useState(null);

  // Search guards
  const searchInFlightRef = useRef(false);
  const lastSearchedCodeRef = useRef(null);

  // 30-Second Image Preview State
  const [previewContent, setPreviewContent] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSecondsLeft, setPreviewSecondsLeft] = useState(30);
  const previewTimerRef = useRef(null);

  const API_URL = window.location.origin;

  useEffect(() => {
    stateMachine.onStateChange = ({ currentState, userMessage }) => {
      setCurrentState(currentState);
      setStatusMessage(userMessage);
    };
  }, [stateMachine]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const codeParam = searchParams.get('code');
    const key = extractKeyFromUrl();
    if (key) {
      setManualKey(key);
    }
    const codeToUse = codeParam || urlFileId;
    if (codeToUse && lastSearchedCodeRef.current !== codeToUse) {
      lastSearchedCodeRef.current = codeToUse;
      setCodeInput(codeToUse);
      handleSearchCode(codeToUse, key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFileId]);

  // 30-Second Preview Countdown Timer & Revocation
  useEffect(() => {
    if (showPreviewModal && previewType === 'image') {
      setPreviewSecondsLeft(30);
      previewTimerRef.current = setInterval(() => {
        setPreviewSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(previewTimerRef.current);
            closeAndRevokePreview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    }

    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, [showPreviewModal, previewType]);

  const closeAndRevokePreview = () => {
    setShowPreviewModal(false);
    if (previewContent && (previewType === 'image' || previewType === 'pdf')) {
      try {
        URL.revokeObjectURL(previewContent);
      } catch (_) {}
    }
    setPreviewContent(null);
    setPreviewType(null);
    setPreviewSecondsLeft(30);
  };

  const handleSearchCode = async (targetCode, targetKey = null) => {
    if (searchInFlightRef.current) return;
    const code = (targetCode || codeInput).trim();
    if (!code) return;

    const parsed = parseTransferCode(code);
    const activeKey = targetKey || parsed.key || extractKeyFromUrl();
    if (activeKey) {
      setManualKey(activeKey);
    } else {
      setManualKey('');
    }

    searchInFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    setIsBurned(false);
    setFileInfo(null);
    setSuccess(false);
    setProgress(null);
    stateMachine.transitionTo(TransferState.CONNECTING);

    if (!parsed.fileId) {
      setError('Invalid transfer code format. Please check and try again.');
      stateMachine.transitionTo(TransferState.FAILED);
      searchInFlightRef.current = false;
      setIsLoading(false);
      return;
    }

    await fetchServerFileInfo(parsed.fileId, activeKey);

    searchInFlightRef.current = false;
    setIsLoading(false);
  };

  const fetchServerFileInfo = async (id, activeKey) => {
    try {
      const response = await fetch(`${API_URL}/api/file-info/${id}`);
      if (response.status === 410) {
        setIsBurned(true);
        setError('This file has self-destructed and is permanently unavailable.');
        stateMachine.transitionTo(TransferState.EXPIRED);
        return;
      }
      if (!response.ok) {
        setError('Transfer session not found or expired. Please check the code.');
        stateMachine.transitionTo(TransferState.FAILED);
        return;
      }

      const data = await response.json();
      setFileInfo(data);
      setNeedsKey(!activeKey);
      stateMachine.transitionTo(TransferState.DOWNLOAD_READY);
    } catch (err) {
      setError('Could not reach server. Please check your network connection.');
      stateMachine.transitionTo(TransferState.FAILED);
    }
  };

  const processServerDecrypt = async (triggerBrowserSave = true) => {
    if (!fileInfo) return;

    const key = manualKey.trim() || extractKeyFromUrl();
    if (!key) {
      setNeedsKey(true);
      setError('Decryption key required. Please paste the decryption key.');
      return;
    }

    setIsDecrypting(true);
    setError(null);
    stateMachine.transitionTo(TransferState.TRANSFERRING);
    setProgress({ stage: 'downloading', percent: 10 });

    try {
      const downloadEndpoint = triggerBrowserSave
        ? `${API_URL}/api/download/${fileInfo.id}`
        : `${API_URL}/api/download/${fileInfo.id}?preview=true`;

      const response = await fetch(downloadEndpoint);
      if (response.status === 410) {
        setIsBurned(true);
        throw new Error('This file has self-destructed (Burn-on-Read active).');
      }
      if (!response.ok) {
        let errMsg = 'Download failed.';
        try {
          const errJson = await response.json();
          if (errJson.detail) errMsg = typeof errJson.detail === 'string' ? errJson.detail : errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const isBurnHeader = response.headers.get('X-Burn-On-Read') === '1';

      const reader = response.body.getReader();
      const contentLength = response.headers.get('Content-Length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let receivedBytes = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const percent = Math.min(99, Math.round((receivedBytes / totalBytes) * 70));
          setProgress({ stage: 'downloading', percent });
        } else {
          setProgress({ stage: 'downloading', percent: 40 });
        }
      }

      const blobData = new Blob(chunks);
      stateMachine.transitionTo(TransferState.VERIFYING);
      setProgress({ stage: 'decrypting', percent: 75 });

      let encryptedPayloadBlob = blobData;
      try {
        const extractedBytes = await extractPayloadFromImage(blobData);
        encryptedPayloadBlob = new Blob([extractedBytes]);
        setProgress({ stage: 'steganography_extracted', percent: 85 });
      } catch (_) {}

      const decryptedData = await decryptFile(
        encryptedPayloadBlob,
        key,
        fileInfo.iv,
        fileInfo.salt,
        (p) => {
          const basePercent = p.stage === 'complete' ? 100 : 85 + Math.round(p.percent * 0.15);
          setProgress({ stage: p.stage, percent: basePercent });
        }
      );

      const ext = fileInfo.original_name.split('.').pop().toLowerCase();
      const isText = ['txt', 'csv', 'json', 'js', 'py', 'html', 'md', 'xml', 'log'].includes(ext);
      const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
      const isPdf = ext === 'pdf';

      const mimeType = fileInfo.mime_type || 'application/octet-stream';
      const decryptedBlob = new Blob([decryptedData], { type: mimeType });
      const url = window.URL.createObjectURL(decryptedBlob);
      setDecryptedBlobUrl(url);

      if (!triggerBrowserSave) {
        if (isText) {
          const textStr = new TextDecoder().decode(decryptedData);
          setPreviewContent(textStr);
          setPreviewType('text');
        } else if (isImg) {
          setPreviewContent(url);
          setPreviewType('image');
        } else if (isPdf) {
          setPreviewContent(url);
          setPreviewType('pdf');
        } else {
          const textStr = new TextDecoder().decode(decryptedData.slice(0, 10000));
          setPreviewContent(textStr);
          setPreviewType('text');
        }
        setShowPreviewModal(true);
      } else {
        // Automatic download trigger
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (isBurnHeader || fileInfo.burn_on_read) {
          setIsBurned(true);
        }
      }

      stateMachine.transitionTo(TransferState.COMPLETED);
      setSuccess(true);
      setProgress({ stage: 'complete', percent: 100 });
    } catch (err) {
      if (!isBurned) {
        setError(err.message || 'Decryption failed. Please check the code/key.');
      }
      stateMachine.transitionTo(TransferState.FAILED);
      setProgress(null);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const val = text.trim();
        setCodeInput(val);
        const parsed = parseTransferCode(val);
        if (parsed.key) setManualKey(parsed.key);
        handleSearchCode(val, parsed.key);
      }
    } catch (_) {}
  };

  const handleNewSearch = () => {
    closeAndRevokePreview();
    setFileInfo(null);
    setError(null);
    setSuccess(false);
    setIsBurned(false);
    setProgress(null);
    setCodeInput('');
    setDecryptedBlobUrl(null);
    stateMachine.transitionTo(TransferState.IDLE);
  };

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Download /> Receive Files</h2>
        <p>Paste the transfer code to connect, verify, and download.</p>
      </div>

      <div className="download-input">
        <input
          type="text"
          placeholder="Paste transfer code (e.g. SEC-4BE819D7-9F8A73C2)"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchCode()}
        />
        <button className="btn btn-secondary" onClick={handlePasteClipboard} title="Paste from clipboard">
          <Copy size={16} /> Paste
        </button>
        <button className="btn btn-primary" onClick={() => handleSearchCode()}>
          <Key size={18} /> Connect & Receive
        </button>
      </div>

      {isLoading && (
        <div className="status-message info">
          <Shield size={18} className="spin" /> {statusMessage}...
        </div>
      )}

      {error && (
        <div className="status-message error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {fileInfo && !success && (
        <div className="file-info animate-in">
          <div className="file-info-header">
            <div className="file-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
              <FileText size={24} />
            </div>
            <div className="file-details">
              <h4>{fileInfo.original_name}</h4>
              <p>
                {formatBytes(fileInfo.original_size)} • Expires {new Date(fileInfo.expires_at).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="file-meta">
            <div className="meta-item">
              <label>File Size</label>
              <span>{formatBytes(fileInfo.original_size)}</span>
            </div>
            <div className="meta-item">
              <label>Protection</label>
              <span style={{ color: '#10b981' }}>AES-256-GCM</span>
            </div>
            <div className="meta-item">
              <label>Status</label>
              <span>{statusMessage}</span>
            </div>
          </div>

          {fileInfo.burn_on_read && !isBurned && (
            <div className="burn-banner">
              <Flame size={24} style={{ color: '#ef4444' }} />
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: '#fca5a5' }}>
                  Burn-on-Read Active
                </strong>
                <span style={{ fontSize: '0.82rem', color: 'rgba(254, 202, 202, 0.8)' }}>
                  File will self-destruct from the server upon download.
                </span>
              </div>
            </div>
          )}

          {needsKey && !isBurned && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className="status-message info">
                <Key size={18} /> Decryption key required
              </div>
              <input
                type="text"
                placeholder="Paste decryption key..."
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.9rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid #10b981',
                  borderRadius: '10px',
                  color: 'var(--foreground)',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          )}

          {!isBurned && !isDecrypting && (
            <div className="action-row" style={{ marginTop: '1.25rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => processServerDecrypt(false)}
                style={{ flex: 1, minHeight: '48px' }}
              >
                <Eye size={18} /> 30-Sec Image Preview
              </button>
              <button
                className="btn btn-primary"
                onClick={() => processServerDecrypt(true)}
                style={{ flex: 1.2, minHeight: '48px' }}
              >
                <Lock size={18} /> Save & Download
              </button>
            </div>
          )}
        </div>
      )}

      {progress && !success && (
        <div className="progress-container" style={{ marginTop: '1.25rem' }}>
          <div className="progress-bar">
            <div className="progress-fill green-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="progress-text">
            <span>{statusMessage}</span>
            <span>{progress.percent}%</span>
          </div>
        </div>
      )}

      {success && fileInfo && (
        <div className="success-section animate-in">
          <div className="success-icon-container">
            <Check size={32} />
          </div>
          <h3>Transfer Decrypted Successfully!</h3>

          <div className="success-file-box">
            <div className="success-file-details">
              <div className="success-file-icon">
                <FileText size={20} />
              </div>
              <div className="success-file-text">
                <strong className="success-file-name">{fileInfo.original_name}</strong>
                <span className="success-file-size">{formatBytes(fileInfo.original_size)}</span>
              </div>
            </div>
          </div>

          {decryptedBlobUrl && (
            <a
              href={decryptedBlobUrl}
              download={fileInfo.original_name}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', minHeight: '48px', textDecoration: 'none' }}
            >
              <Download size={20} /> Save File to Downloads
            </a>
          )}

          <button className="btn btn-secondary" onClick={handleNewSearch} style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem', minHeight: '48px' }}>
            Receive Another File
          </button>
        </div>
      )}

      {isBurned && !success && (
        <div className="burn-banner" style={{ background: 'rgba(220, 38, 38, 0.2)', borderColor: '#ef4444', marginTop: '1.25rem' }}>
          <Flame size={24} style={{ color: '#ef4444' }} />
          <div>
            <strong style={{ fontSize: '1rem', color: '#f87171' }}>File Self-Destructed & Purged!</strong>
            <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '0.2rem' }}>
              The server permanently deleted this file.
            </p>
          </div>
        </div>
      )}

      {/* 30-Second Image Preview Modal */}
      {showPreviewModal && (
        <div className="preview-overlay">
          <div className="preview-modal">
            <div className="preview-header">
              <h3><Eye size={20} /> Preview: {fileInfo?.original_name}</h3>
              {previewType === 'image' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>
                  <Clock size={16} /> Expires in: {previewSecondsLeft}s
                </div>
              )}
              <button className="preview-close" onClick={closeAndRevokePreview} aria-label="Close preview">
                <X size={20} />
              </button>
            </div>
            <div className="preview-body">
              {previewType === 'text' && (
                <pre className="preview-text">{previewContent}</pre>
              )}
              {previewType === 'image' && (
                <div style={{ textAlign: 'center' }}>
                  <img src={previewContent} alt="30-Second Temporary Preview" className="preview-image" />
                </div>
              )}
              {previewType === 'pdf' && (
                <iframe src={previewContent} title="PDF Preview" className="preview-pdf" />
              )}
            </div>
            <div className="preview-footer">
              <button className="btn btn-primary" onClick={() => { closeAndRevokePreview(); processServerDecrypt(true); }}>
                <Download size={16} /> Save & Download File
              </button>
              <button className="btn btn-secondary" onClick={closeAndRevokePreview}>
                Done Viewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadPage