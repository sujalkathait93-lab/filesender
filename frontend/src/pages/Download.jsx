import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Download, Lock, Shield, Check, Key, Flame,
  Eye, X, ArrowLeft, FileText, Copy, Clock,
  Image as ImageIcon, Video, Music, FileCode, File,
  Loader2, Search, Radio, RotateCcw, FolderDown, ShieldCheck
} from 'lucide-react'
import { parseTransferCode, extractKeyFromUrl, formatBytes } from '../crypto'
import { detectFileType } from '../fileManager'
import { TransferStateMachine, TransferState } from '../stateMachine'
import { PreviewManager } from '../previewManager'
import { useDownload } from '../hooks/useDownload'
import { useP2PSession } from '../hooks/useP2PSession'
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

  // Preview State (No artificial time limit)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
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
    downloadSingleFile,
    downloadAllFiles,
    resetDownloadState,
    revokeDecryptedUrl
  } = useDownload(stateMachine);

  const { p2pStatus, p2pState, startP2P, stopP2P } = useP2PSession();

  // Initialize Preview Manager
  useEffect(() => {
    previewManagerRef.current = new PreviewManager({
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

  useEffect(() => {
    if (fileInfo?.id) startP2P(fileInfo.id, 'receiver');
    return () => stopP2P();
  }, [fileInfo?.id, startP2P, stopP2P]);

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

  const closeAndRevokePreview = useCallback(() => {
    setShowPreviewModal(false);
    if (previewManagerRef.current) {
      previewManagerRef.current.close();
    }
    setActivePreviewItem(null);
  }, []);

  useEffect(() => {
    if (!showPreviewModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeAndRevokePreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPreviewModal, closeAndRevokePreview]);

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
        <p>Paste your full transfer code below to connect, preview, and download encrypted files.</p>
      </div>

      <div className="download-input" role="search">
        <input
          type="text"
          placeholder="Paste transfer code (e.g. FS-A1B2C3D4E5F60708-9F8A73C21D2E3F40)"
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
        <div className="download-input-actions">
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
                <Key size={18} /> Connect &amp; Receive
              </>
            )}
          </button>
        </div>
      </div>

      {/* Skeletons */}
      {isLoading && <FileInfoSkeleton />}

      {/* Error state */}
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
          title="No active transfer selected"
          description="Enter a transfer code or share link from the sender to connect, inspect file details, preview, and download."
          actionText="Paste from Clipboard"
          onAction={handlePasteClipboard}
        />
      )}

      {fileInfo && !success && (
        <div className="file-info animate-in">
          <div className="file-info-header">
            <div className="file-icon" style={{ backgroundColor: 'var(--secondary-tint)', color: 'var(--secondary)' }}>
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
              <label>Total Size</label>
              <span>{formatBytes(fileInfo.original_size)}</span>
            </div>
            <div className="meta-item">
              <label>Downloads</label>
              <span style={{ color: fileInfo.max_downloads === 0 ? 'var(--secondary)' : undefined }}>
                {fileInfo.max_downloads === 0
                  ? 'Unlimited'
                  : fileInfo.max_downloads === 1
                  ? '1 (Burn on read)'
                  : `${fileInfo.download_count} of ${fileInfo.max_downloads} used`}
              </span>
            </div>
            <div className="meta-item">
              <label>Expires</label>
              <span>{new Date(fileInfo.expires_at).toLocaleTimeString()}</span>
            </div>
          </div>

          {fileInfo.burn_on_read && !isBurned && (
            <div className="burn-banner">
              <Flame size={24} style={{ color: 'var(--error)' }} />
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block' }}>
                  Burn-on-Read Active
                </strong>
                <span style={{ fontSize: '0.825rem' }}>
                  File permanently self-destructs from the server immediately after download.
                </span>
              </div>
            </div>
          )}

          {p2pStatus && (p2pState === 'waiting' || p2pState === 'connected') && (
            <div className="status-message info" style={{ marginTop: '1rem' }}>
              <Radio size={18} /> {p2pStatus} REST download below still works.
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
                title="View files in browser without downloading"
              >
                {isDecrypting ? <Loader2 size={18} className="spin" /> : <Eye size={18} />}
                <span>Preview Files</span>
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
                    <Lock size={18} /> Save &amp; Download
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

          {/* If Multi-File Bundle: Show All Unpacked Files with Individual Actions */}
          {decryptedFiles.length > 1 ? (
            <div className="unpacked-files-container" style={{ margin: '1.25rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--fg-main)' }}>
                  Files in Transfer ({decryptedFiles.length})
                </h4>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={downloadAllFiles}
                >
                  <FolderDown size={16} /> Download All ({decryptedFiles.length} Files)
                </button>
              </div>

              <div className="unpacked-files-list">
                {decryptedFiles.map((file, idx) => (
                  <div key={idx} className="file-item">
                    <div className="file-item-left">
                      <div className="file-icon" style={{ backgroundColor: 'var(--secondary-tint)', color: 'var(--secondary)' }}>
                        {getCategoryIcon(detectFileType(file.name, file.type).category)}
                      </div>
                      <div>
                        <div className="file-item-name">{file.name}</div>
                        <div className="file-item-size">{formatBytes(file.size)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const prepared = previewManagerRef.current.preparePreview(file);
                          setActivePreviewItem(prepared);
                          setPreviewBundleFiles(decryptedFiles);
                          setActivePreviewIndex(idx);
                          setShowPreviewModal(true);
                        }}
                        title="Preview this file"
                      >
                        <Eye size={14} /> Preview
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => downloadSingleFile(file)}
                        title="Download this file"
                      >
                        <Download size={14} /> Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="success-file-box">
              <div className="success-file-details">
                <div className="file-icon" style={{ backgroundColor: 'var(--secondary-tint)', color: 'var(--secondary)' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <strong className="success-file-name">{decryptedFiles[0]?.name || fileInfo.original_name}</strong>
                  <span className="success-file-size">{formatBytes(decryptedFiles[0]?.size || fileInfo.original_size)}</span>
                </div>
              </div>
            </div>
          )}

          {isBurned && (
            <div className="burn-banner">
              <Flame size={24} style={{ color: 'var(--error)' }} />
              <div>
                <strong style={{ fontSize: '0.95rem' }}>File Self-Destructed &amp; Purged!</strong>
                <p style={{ fontSize: '0.825rem', marginTop: '0.2rem' }}>
                  The server permanently deleted this file after your download.
                </p>
              </div>
            </div>
          )}

          {decryptedFiles.length <= 1 && decryptedBlobUrl && (
            <a
              href={decryptedBlobUrl}
              download={decryptedFiles[0]?.name || fileInfo.original_name}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', textDecoration: 'none', marginTop: '1rem' }}
            >
              <Download size={20} /> Save File to Downloads
            </a>
          )}

          <button className="btn btn-secondary" onClick={handleNewSearch} style={{ width: '100%', marginTop: '0.75rem', minHeight: '48px' }}>
            <RotateCcw size={16} /> Receive Another File
          </button>
        </div>
      )}

      {isBurned && !success && (
        <div className="burn-banner">
          <Flame size={24} style={{ color: 'var(--error)' }} />
          <div>
            <strong style={{ fontSize: '0.95rem' }}>File Self-Destructed &amp; Purged!</strong>
            <p style={{ fontSize: '0.825rem', marginTop: '0.2rem' }}>
              The server permanently deleted this file.
            </p>
          </div>
        </div>
      )}

      {/* Clean Universal Preview Modal (No artificial countdown timer) */}
      {showPreviewModal && activePreviewItem && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="File Preview">
          <div className="preview-modal">
            <div className="preview-header">
              <h3>
                {getCategoryIcon(activePreviewItem.category)}
                <span>Preview: {activePreviewItem.fileName}</span>
              </h3>

              <div className="badge badge-primary">
                <Eye size={14} style={{ marginRight: '0.3rem' }} /> In-Browser Preview
              </div>

              <button className="preview-close" onClick={closeAndRevokePreview} aria-label="Close preview">
                <X size={20} />
              </button>
            </div>

            {/* Multi-file tab selector if transfer has multiple files */}
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
                    alt="Decrypted Preview"
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
                  <Music size={48} style={{ color: 'var(--secondary)', marginBottom: '1rem' }} />
                  <p style={{ fontWeight: 700, marginBottom: '1rem' }}>{activePreviewItem.fileName}</p>
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

              {/* Unsupported binary */}
              {!activePreviewItem.canPreviewDirectly && (
                <div className="preview-unsupported-card">
                  <div className="file-icon" style={{ margin: '0 auto 1rem', width: 52, height: 52 }}>
                    <FileText size={28} />
                  </div>
                  <h4>{activePreviewItem.fileName}</h4>
                  <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
                    Binary file ({activePreviewItem.mimeType || 'octet-stream'}). Download to view in your system viewer.
                  </p>

                  <div className="preview-meta-table">
                    <div className="preview-meta-row">
                      <span className="label">File Size:</span>
                      <span className="val">{formatBytes(activePreviewItem.fileSize)}</span>
                    </div>
                    <div className="preview-meta-row">
                      <span className="label">Security:</span>
                      <span className="val" style={{ color: 'var(--secondary)' }}>Verified AES-256-GCM</span>
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
                <Download size={16} /> Save &amp; Download File
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

export default DownloadPage;
