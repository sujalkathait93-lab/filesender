import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Download, Lock, Shield, Check, Key, Flame,
  Eye, X, ArrowLeft, FileText, Copy, Clock,
  Image as ImageIcon, Video, Music, FileCode, File,
  Loader2, Search, Sparkles
} from 'lucide-react'
import { parseTransferCode, extractKeyFromUrl, formatBytes } from '../crypto'
import { TransferStateMachine, TransferState } from '../stateMachine'
import { PreviewManager, PREVIEW_DURATION_SECONDS } from '../previewManager'
import { useDownload } from '../hooks/useDownload'
import { FileInfoSkeleton, PreviewMediaSkeleton } from '../components/Skeletons'
import { EmptyState, ErrorAlert, MeasurableProgressBar } from '../components/FeedbackStates'

function DownloadPage() {
  const { fileId: urlFileId } = useParams();
  const navigate = useNavigate();
  const [stateMachine] = useState(() => new TransferStateMachine(TransferState.IDLE));
  const [currentState, setCurrentState] = useState(TransferState.IDLE);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [codeInput, setCodeInput] = useState(urlFileId || '');

  // Search guards (avoid duplicate requests)
  const searchInFlightRef = useRef(false);
  const lastSearchedCodeRef = useRef(null);

  // 30-Second Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSecondsLeft, setPreviewSecondsLeft] = useState(PREVIEW_DURATION_SECONDS);
  const [activePreviewItem, setActivePreviewItem] = useState(null);
  const [previewBundleFiles, setPreviewBundleFiles] = useState([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(true);

  const previewManagerRef = useRef(null);

  const {
    fileInfo,
    isLoading,
    isDecrypting,
    progress,
    error,
    success,
    isBurned,
    manualKey,
    needsKey,
    decryptedFiles,
    decryptedBlobUrl,
    setManualKey,
    searchCode,
    executeDownload,
    resetDownloadState,
    revokeDecryptedUrl
  } = useDownload(stateMachine);

  // Initialize Preview Manager
  useEffect(() => {
    previewManagerRef.current = new PreviewManager({
      onTick: (secs) => setPreviewSecondsLeft(secs),
      onExpire: () => {
        setShowPreviewModal(false);
        setActivePreviewItem(null);
      },
      onClose: () => {
        setShowPreviewModal(false);
        setActivePreviewItem(null);
      }
    });

    return () => {
      if (previewManagerRef.current) {
        previewManagerRef.current.cleanup();
      }
    };
  }, []);

  useEffect(() => {
    stateMachine.onStateChange = ({ currentState, userMessage }) => {
      setCurrentState(currentState);
      setStatusMessage(userMessage);
    };
  }, [stateMachine]);

  // Auto-search when arriving with ?code=... in the URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const codeParam = searchParams.get('code');
    const key = extractKeyFromUrl();
    const codeToUse = codeParam || urlFileId;
    if (codeToUse && lastSearchedCodeRef.current !== codeToUse && !searchInFlightRef.current) {
      lastSearchedCodeRef.current = codeToUse;
      setCodeInput(codeToUse);
      searchCode(codeToUse, key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFileId]);

  const closeAndRevokePreview = () => {
    setShowPreviewModal(false);
    if (previewManagerRef.current) {
      previewManagerRef.current.close();
    }
    setActivePreviewItem(null);
    setPreviewSecondsLeft(PREVIEW_DURATION_SECONDS);
  };

  const handleSearchCode = (targetCode, targetKey = null) => {
    if (searchInFlightRef.current || isLoading) return;
    const target = targetCode || codeInput;
    if (!target.trim()) return;
    searchInFlightRef.current = true;
    searchCode(target, targetKey).finally(() => {
      searchInFlightRef.current = false;
    });
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const val = text.trim();
        setCodeInput(val);
        const parsed = parseTransferCode(val);
        handleSearchCode(val, parsed.key);
      }
    } catch (_) {}
  };

  const handleNewSearch = () => {
    closeAndRevokePreview();
    revokeDecryptedUrl();
    resetDownloadState();
    setCodeInput('');
    stateMachine.transitionTo(TransferState.IDLE);
  };

  const handlePreviewReady = (firstFile, unpacked) => {
    if (!previewManagerRef.current) return;
    const allFiles = unpacked?.files || [firstFile];
    setPreviewBundleFiles(allFiles);
    setActivePreviewIndex(0);
    setMediaLoading(true);

    const prepared = previewManagerRef.current.preparePreview(firstFile);
    setActivePreviewItem(prepared);
    setShowPreviewModal(true);
  };

  const handleSelectPreviewFile = (index) => {
    if (!previewBundleFiles[index] || !previewManagerRef.current) return;
    setActivePreviewIndex(index);
    setMediaLoading(true);
    const prepared = previewManagerRef.current.preparePreview(previewBundleFiles[index]);
    setActivePreviewItem(prepared);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'image': return <ImageIcon size={22} />;
      case 'video': return <Video size={22} />;
      case 'audio': return <Music size={22} />;
      case 'text': return <FileCode size={22} />;
      case 'pdf': return <FileText size={22} />;
      default: return <File size={22} />;
    }
  };

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Download /> Receive Files</h2>
        <p>Paste the transfer code to connect, verify, preview, and download.</p>
      </div>

      <div className="download-input" role="search">
        <input
          type="text"
          placeholder="Paste transfer code (e.g. SEC-4BE819D7-9F8A73C2)"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchCode()}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck="false"
          disabled={isLoading || isDecrypting}
          aria-label="Transfer Code"
        />
        <button
          className="btn btn-secondary"
          onClick={handlePasteClipboard}
          title="Paste from clipboard"
          disabled={isLoading || isDecrypting}
        >
          <Copy size={16} /> Paste
        </button>
        <button
          className="btn btn-primary"
          onClick={() => handleSearchCode()}
          disabled={isLoading || isDecrypting || !codeInput.trim()}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="spin" /> Connecting...
            </>
          ) : (
            <>
              <Key size={18} /> Connect & Receive
            </>
          )}
        </button>
      </div>

      {/* Skeletons: rendered during initial lookup to prevent layout shifts (CLS) */}
      {isLoading && <FileInfoSkeleton />}

      {/* Error state with retry action */}
      {error && !isLoading && (
        <ErrorAlert
          message={error}
          onRetry={codeInput ? () => handleSearchCode(codeInput) : null}
        />
      )}

      {/* Empty State when idle */}
      {!fileInfo && !isLoading && !error && !success && !isBurned && (
        <EmptyState
          icon={Search}
          title="Ready to receive files"
          description="Enter a transfer code or link from the sender to securely connect, inspect with 30-second preview, and decrypt."
          actionText="Paste from Clipboard"
          onAction={handlePasteClipboard}
        />
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

          {/* Progress feedback while decrypting / downloading */}
          {progress && isDecrypting && (
            <div style={{ marginTop: '1.25rem' }}>
              <MeasurableProgressBar
                stage={progress.stage}
                percent={progress.percent}
                statusMessage={statusMessage}
              />
            </div>
          )}

          {!isBurned && (
            <div className="action-row" style={{ marginTop: '1.25rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => executeDownload(false, handlePreviewReady)}
                disabled={isDecrypting}
                style={{ flex: 1, minHeight: '48px' }}
              >
                {isDecrypting ? <Loader2 size={18} className="spin" /> : <Eye size={18} />}
                <span>30-Sec Preview</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => executeDownload(true)}
                disabled={isDecrypting}
                aria-busy={isDecrypting}
                style={{ flex: 1.2, minHeight: '48px' }}
              >
                {isDecrypting ? (
                  <>
                    <Loader2 size={18} className="spin" /> Decrypting...
                  </>
                ) : (
                  <>
                    <Lock size={18} /> Save & Download
                  </>
                )}
              </button>
            </div>
          )}
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
                <strong className="success-file-name">
                  {decryptedFiles.length > 1
                    ? `${decryptedFiles.length} files saved (${fileInfo.original_name})`
                    : fileInfo.original_name}
                </strong>
                <span className="success-file-size">{formatBytes(fileInfo.original_size)}</span>
              </div>
            </div>
          </div>

          {isBurned && (
            <div className="burn-banner" style={{ background: 'rgba(220, 38, 38, 0.2)', borderColor: '#ef4444', marginTop: '1.25rem' }}>
              <Flame size={24} style={{ color: '#ef4444' }} />
              <div>
                <strong style={{ fontSize: '1rem', color: '#f87171' }}>File Self-Destructed & Purged!</strong>
                <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '0.2rem' }}>
                  The server permanently deleted this file after your download.
                </p>
              </div>
            </div>
          )}

          {decryptedBlobUrl && (
            <a
              href={decryptedBlobUrl}
              download={fileInfo.original_name}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', minHeight: '48px', textDecoration: 'none', marginTop: '1rem' }}
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

      {/* Universal 30-Second Preview Modal for ALL file types */}
      {showPreviewModal && activePreviewItem && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="30-Second Temporary Preview">
          <div className="preview-modal">
            <div className="preview-header">
              <h3>
                {getCategoryIcon(activePreviewItem.category)}
                <span>Preview: {activePreviewItem.fileName}</span>
              </h3>

              {/* 30-Second Countdown Badge */}
              <div className="preview-timer-badge">
                <Clock size={16} />
                <span>{previewSecondsLeft}s remaining</span>
              </div>

              <button className="preview-close" onClick={closeAndRevokePreview} aria-label="Close preview">
                <X size={20} />
              </button>
            </div>

            {/* Multi-file selector bar if transfer has multiple files */}
            {previewBundleFiles.length > 1 && (
              <div className="preview-bundle-bar">
                {previewBundleFiles.map((f, i) => (
                  <button
                    key={i}
                    className={`preview-bundle-tab ${i === activePreviewIndex ? 'active' : ''}`}
                    onClick={() => handleSelectPreviewFile(i)}
                  >
                    {f.name} ({formatBytes(f.size)})
                  </button>
                ))}
              </div>
            )}

            <div className="preview-body">
              {/* Image Preview */}
              {activePreviewItem.category === 'image' && (
                <div style={{ textAlign: 'center', position: 'relative' }}>
                  {mediaLoading && <PreviewMediaSkeleton height="280px" />}
                  <img
                    src={activePreviewItem.content}
                    alt="30-Second Temporary Preview"
                    className="preview-image"
                    style={{ display: mediaLoading ? 'none' : 'block' }}
                    onLoad={() => setMediaLoading(false)}
                    onError={() => setMediaLoading(false)}
                  />
                </div>
              )}

              {/* Video Preview */}
              {activePreviewItem.category === 'video' && (
                <div style={{ textAlign: 'center', position: 'relative' }}>
                  {mediaLoading && <PreviewMediaSkeleton height="280px" />}
                  <video
                    src={activePreviewItem.content}
                    controls
                    autoPlay
                    className="preview-video"
                    playsInline
                    style={{ display: mediaLoading ? 'none' : 'block' }}
                    onLoadedData={() => setMediaLoading(false)}
                    onError={() => setMediaLoading(false)}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              )}

              {/* Audio Preview */}
              {activePreviewItem.category === 'audio' && (
                <div className="preview-audio-wrapper">
                  <Music size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
                  <p style={{ fontWeight: 600, marginBottom: '1rem' }}>{activePreviewItem.fileName}</p>
                  <audio
                    src={activePreviewItem.content}
                    controls
                    autoPlay
                    className="preview-audio"
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {/* PDF Preview */}
              {activePreviewItem.category === 'pdf' && (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <iframe
                    src={activePreviewItem.content}
                    title="PDF Preview"
                    className="preview-pdf"
                  />
                </div>
              )}

              {/* Text / Code Preview */}
              {activePreviewItem.category === 'text' && (
                <pre className="preview-text">{activePreviewItem.content}</pre>
              )}

              {/* Unsupported format / Document metadata info screen */}
              {!activePreviewItem.canPreviewDirectly && (
                <div className="preview-unsupported-card">
                  <div className="preview-unsupported-icon">
                    <FileText size={40} />
                  </div>
                  <h4>{activePreviewItem.fileName}</h4>
                  <p className="preview-unsupported-desc">
                    This file format ({activePreviewItem.mimeType || 'binary'}) cannot be rendered directly inside the browser viewport.
                  </p>

                  <div className="preview-meta-table">
                    <div className="preview-meta-row">
                      <span className="label">File Size:</span>
                      <span className="val">{formatBytes(activePreviewItem.fileSize)}</span>
                    </div>
                    <div className="preview-meta-row">
                      <span className="label">MIME Type:</span>
                      <span className="val">{activePreviewItem.mimeType}</span>
                    </div>
                    <div className="preview-meta-row">
                      <span className="label">Encryption:</span>
                      <span className="val" style={{ color: '#10b981' }}>Verified AES-256-GCM</span>
                    </div>
                    <div className="preview-meta-row">
                      <span className="label">Preview Session:</span>
                      <span className="val" style={{ color: '#ef4444' }}>Auto-expires in {previewSecondsLeft}s</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="preview-footer">
              <button
                className="btn btn-primary"
                onClick={() => {
                  closeAndRevokePreview();
                  executeDownload(true);
                }}
              >
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
