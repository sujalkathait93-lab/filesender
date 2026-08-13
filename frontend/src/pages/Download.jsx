import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, Lock, Shield, AlertTriangle, Check, Key, Flame, Eye, X, ArrowLeft, FileText, Info, Copy } from 'lucide-react'
import { decryptFile, extractKeyFromUrl, parseTransferCode, formatBytes } from '../crypto'
import { extractPayloadFromImage } from '../steganography'

function DownloadPage({ serverUrl }) {
  const { fileId: urlFileId } = useParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState(urlFileId || '');
  const [fileInfo, setFileInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isBurned, setIsBurned] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [needsKey, setNeedsKey] = useState(false);

  // Guards against duplicate searches (React StrictMode double-mount / double effect)
  const searchInFlightRef = useRef(false);
  const lastSearchedCodeRef = useRef(null);

  // In-Browser Preview State
  const [previewContent, setPreviewContent] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const API_URL = serverUrl || window.location.origin;

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

  /**
   * Search flow:
   * 1. Parse the code to extract the file ID + decryption key.
   * 2. Ask the server for the file metadata.
   * 3. If found, let the user preview or download.
   */
  const handleSearchCode = async (targetCode, targetKey = null) => {
    if (searchInFlightRef.current) return;
    const code = (targetCode || codeInput).trim();
    if (!code) return;

    const parsed = parseTransferCode(code);
    const activeKey = targetKey || parsed.key || manualKey || extractKeyFromUrl();
    if (parsed.key) setManualKey(parsed.key);

    searchInFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    setIsBurned(false);
    setFileInfo(null);
    setSuccess(false);
    setProgress(null);

    if (!parsed.fileId) {
      setError('That does not look like a valid SecureShare code. Make sure you copied the full code.');
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
        setError('This file was set to Burn-on-Read and has already self-destructed.');
        return;
      }
      if (!response.ok) {
        setError(
          'We could not find a file with this code. Check the code, or ask the sender ' +
          'to confirm the file has not expired.'
        );
        return;
      }

      const data = await response.json();
      setFileInfo(data);
      setNeedsKey(!activeKey);
    } catch (err) {
      setError('Could not reach the server. Make sure the backend is running and try again.');
    }
  };

  const processServerDecrypt = async (triggerBrowserSave = true) => {
    if (!fileInfo) return;

    const key = manualKey.trim() || extractKeyFromUrl();
    if (!key) {
      setNeedsKey(true);
      setError('Please paste the decryption key that the sender shared with you.');
      return;
    }

    setIsDecrypting(true);
    setError(null);
    setProgress({ stage: 'downloading', percent: 10 });

    try {
      const downloadEndpoint = triggerBrowserSave
        ? `${API_URL}/api/download/${fileInfo.id}`
        : `${API_URL}/api/download/${fileInfo.id}?preview=true`;

      const response = await fetch(downloadEndpoint);
      if (response.status === 410) {
        setIsBurned(true);
        throw new Error('This file has self-destructed and was permanently removed from the server.');
      }
      if (!response.ok) {
        let errMsg = 'Download failed. Please try again.';
        try {
          const errJson = await response.json();
          if (errJson.detail) errMsg = typeof errJson.detail === 'string' ? errJson.detail : errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const isBurnHeader = response.headers.get('X-Burn-On-Read') === '1';

      let blobData = await response.blob();
      setProgress({ stage: 'decrypting', percent: 35 });

      let encryptedPayloadBlob = blobData;
      try {
        const extractedBytes = await extractPayloadFromImage(blobData);
        encryptedPayloadBlob = new Blob([extractedBytes]);
        setProgress({ stage: 'steganography_extracted', percent: 55 });
      } catch (_) {}

      const decryptedData = await decryptFile(
        encryptedPayloadBlob,
        key,
        fileInfo.iv,
        fileInfo.salt,
        (p) => setProgress(p)
      );

      const ext = fileInfo.original_name.split('.').pop().toLowerCase();
      const isText = ['txt', 'csv', 'json', 'js', 'py', 'html', 'md', 'xml', 'log'].includes(ext);
      const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
      const isPdf = ext === 'pdf';

      if (!triggerBrowserSave) {
        if (isText) {
          const textStr = new TextDecoder().decode(decryptedData);
          setPreviewContent(textStr);
          setPreviewType('text');
        } else if (isImg) {
          const imgBlob = new Blob([decryptedData], { type: `image/${ext}` });
          setPreviewContent(URL.createObjectURL(imgBlob));
          setPreviewType('image');
        } else if (isPdf) {
          const pdfBlob = new Blob([decryptedData], { type: 'application/pdf' });
          setPreviewContent(URL.createObjectURL(pdfBlob));
          setPreviewType('pdf');
        } else {
          const textStr = new TextDecoder().decode(decryptedData.slice(0, 10000));
          setPreviewContent(textStr);
          setPreviewType('text');
        }
        setShowPreviewModal(true);
      } else {
        const blob = new Blob([decryptedData]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        if (isBurnHeader || fileInfo.burn_on_read) {
          setIsBurned(true);
        }
      }

      setSuccess(true);
      setProgress({ stage: 'complete', percent: 100 });
    } catch (err) {
      if (!isBurned) {
        setError(err.message || 'Decryption failed. Check that the code/key is correct.');
      }
      setProgress(null);
    } finally {
      setIsDecrypting(false);
    }
  };

  const getStageText = (stage) => {
    const texts = {
      downloading: 'Downloading encrypted file...',
      steganography_extracted: 'Extracting hidden data from image...',
      decrypting: 'Decrypting with AES-256-GCM...',
      decompressing: 'Decompressing file...',
      complete: 'Done!'
    };
    return texts[stage] || stage;
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
    setFileInfo(null);
    setError(null);
    setSuccess(false);
    setIsBurned(false);
    setProgress(null);
    setCodeInput('');
  };

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Download /> Receive a File</h2>
        <p>Paste the code that the sender shared with you.</p>
      </div>

      <div className="download-input">
        <input
          type="text"
          placeholder="Paste the share code (e.g. SEC-4BE819D7-9F8A73C2)"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchCode()}
        />
        <button className="btn btn-secondary" onClick={handlePasteClipboard} title="Paste from clipboard">
          <Copy size={16} /> Paste
        </button>
        <button className="btn btn-primary" onClick={() => handleSearchCode()}>
          <Key size={18} /> Receive File
        </button>
      </div>

      <div className="security-notice" style={{ marginBottom: '1.25rem' }}>
        <Info size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
        The file is decrypted in your browser. The decryption key is inside the share code, so the server can never read your file.
      </div>

      {isLoading && (
        <div className="status-message info">
          <Shield size={18} className="spin" /> Looking up your file...
        </div>
      )}

      {error && (
        <div className="status-message error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {fileInfo && (
        <div className="file-info animate-in">
          <div className="file-info-header">
            <div className="file-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
              <FileText size={24} />
            </div>
            <div className="file-details">
              <h4>{fileInfo.original_name}</h4>
              <p>
                {formatBytes(fileInfo.original_size)} • Expires {new Date(fileInfo.expires_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="file-meta">
            <div className="meta-item">
              <label>File Size</label>
              <span>{formatBytes(fileInfo.original_size)}</span>
            </div>
            <div className="meta-item">
              <label>Encrypted Size</label>
              <span>{formatBytes(fileInfo.encrypted_size)}</span>
            </div>
            <div className="meta-item">
              <label>Protection</label>
              <span style={{ color: '#10b981' }}>AES-256 + Steganography</span>
            </div>
          </div>

          {fileInfo.burn_on_read && !isBurned && (
            <div className="burn-banner">
              <Flame size={24} style={{ color: '#ef4444' }} />
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: '#fca5a5' }}>
                  Burn-on-Read Self-Destruct Active
                </strong>
                <span style={{ fontSize: '0.82rem', color: 'rgba(254, 202, 202, 0.8)' }}>
                  This file will be permanently deleted from the server when you download it.
                </span>
              </div>
            </div>
          )}

          {needsKey && !isBurned && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className="status-message info">
                <Key size={18} /> Decryption key required
              </div>
              <p className="hint-text" style={{ marginTop: '0.5rem' }}>
                The key is the second half of the share code (after the first dash). If the sender only gave you a
                partial code, paste the full code instead.
              </p>
              <input
                type="text"
                placeholder="Paste the decryption key here..."
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '1rem',
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
                style={{ flex: 1 }}
              >
                <Eye size={18} /> Quick View
              </button>
              <button
                className="btn btn-primary"
                onClick={() => processServerDecrypt(true)}
                style={{ flex: 1.2 }}
              >
                <Lock size={18} /> Save & Download
              </button>
            </div>
          )}

          {success && !isBurned && (
            <button className="btn btn-secondary" onClick={handleNewSearch} style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }}>
              Receive Another File
            </button>
          )}
        </div>
      )}

      {progress && (
        <div className="progress-container" style={{ marginTop: '1.25rem' }}>
          <div className="progress-bar">
            <div className="progress-fill green-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="progress-text">
            <span>{getStageText(progress.stage)}</span>
            <span>{progress.percent}%</span>
          </div>
        </div>
      )}

      {success && !fileInfo && (
        <div className="status-message success" style={{ marginTop: '1.25rem' }}>
          <Check size={18} /> File received and decrypted successfully!
        </div>
      )}

      {isBurned && (
        <div className="burn-banner" style={{ background: 'rgba(220, 38, 38, 0.2)', borderColor: '#ef4444', marginTop: '1.25rem' }}>
          <Flame size={24} style={{ color: '#ef4444' }} />
          <div>
            <strong style={{ fontSize: '1rem', color: '#f87171' }}>File Self-Destructed & Purged!</strong>
            <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '0.2rem' }}>
              The server permanently deleted this file. This code will no longer work.
            </p>
          </div>
        </div>
      )}

      {/* Quick View In-Browser Preview Modal */}
      {showPreviewModal && (
        <div className="preview-overlay">
          <div className="preview-modal">
            <div className="preview-header">
              <h3><Eye size={20} /> Preview: {fileInfo?.original_name}</h3>
              <button className="preview-close" onClick={() => setShowPreviewModal(false)} aria-label="Close preview">
                <X size={20} />
              </button>
            </div>
            <div className="preview-body">
              {previewType === 'text' && (
                <pre className="preview-text">{previewContent}</pre>
              )}
              {previewType === 'image' && (
                <div style={{ textAlign: 'center' }}>
                  <img src={previewContent} alt="Secure Preview" className="preview-image" />
                </div>
              )}
              {previewType === 'pdf' && (
                <iframe src={previewContent} title="PDF Preview" className="preview-pdf" />
              )}
            </div>
            <div className="preview-footer">
              <button className="btn btn-primary" onClick={() => { setShowPreviewModal(false); processServerDecrypt(true); }}>
                <Download size={16} /> Save & Download File
              </button>
              <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>
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