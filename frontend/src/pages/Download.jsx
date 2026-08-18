import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Download, Lock, Shield, Check, Key, Flame,
  Eye, X, ArrowLeft, FileText, Copy, Clock,
  Image as ImageIcon, Video, Music, FileCode, File,
  Loader2, Search, Radio, RotateCcw, FolderDown, ShieldCheck,
  Archive, Package
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

  // Search guards
  const searchInFlightRef = useRef(false);
  const lastSearchedCodeRef = useRef(null);

  // Preview State
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
      case 'image': return <ImageIcon size={20} />;
      case 'video': return <Video size={20} />;
      case 'audio': return <Music size={20} />;
      case 'text': return <FileCode size={20} />;
      case 'pdf': return <FileText size={20} />;
      case 'archive': return <Archive size={20} />;
      case 'document': return <FileText size={20} />;
      case 'app': return <Package size={20} />;
      default: return <File size={20} />;
    }
  };

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary btn-sm back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={15} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Download size={22} /> Receive Files</h2>
        <p>Paste your full transfer code below to connect, preview, and download encrypted files.</p>
      </div>

      <div className="download-input" role="search">
        <input
          type="text"
          placeholder="Paste transfer code (e.g. FS-A1B2C3D4E5F60708-9F8A73C21D2E3F40)"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.replace(/[^a-zA-Z0-9\-:_/?.#=&]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchCode()}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          data-lpignore="true"
          data-form-type="other"
          maxLength={128}
          disabled={isLoading || isDecrypting}
          aria-label="Transfer Code"
        />
        <div className="download-input-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePasteClipboard}
            title="Paste from clipboard"
            disabled={isLoading || isDecrypting}
          >
            <Copy size={14} /> Paste
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleSearchCode()}
            disabled={isLoading || isDecrypting || !codeInput.trim()}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="spin" /> Connecting...
              </>
            ) : (
              <>
                <Key size={15} /> Connect &amp; Receive
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Skeletons */}
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
            <div className="file-icon file-icon--success">
              <FileText size={20} />
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
              <span>
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
              <Flame size={20} className="burn-icon" />
              <div>
                <strong className="burn-title">
                  Burn-on-Read Active
                </strong>
                <span className="burn-copy">
                  File permanently self-destructs from the server immediately after download.
                </span>
              </div>
            </div>
          )}

          {p2pStatus && (p2pState === 'waiting' || p2pState === 'connected') && (
            <div className="status-message info" style={{ marginBottom: 16 }}>
              <Radio size={16} />
              <span>{p2pStatus} REST download below still works.</span>
            </div>
          )}

          {needsKey && !isBurned && (
            <div className="manual-key-section">
              <div className="status-message info">
                <Key size={16} />
                <span>Decryption key required</span>
              </div>
              <input
                type="text"
                placeholder="Paste decryption key..."
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                className="manual-key-input"
              />
            </div>
          )}

          {/* Progress feedback while decrypting / downloading */}
          {progress && isDecrypting && (
            <div style={{ marginBottom: 16 }}>
              <MeasurableProgressBar
                stage={progress.stage}
                percent={progress.percent}
                statusMessage={statusMessage}
              />
            </div>
          )}

          {!isBurned && (
            <div className="download-actions">
              <button
                onClick={() => executeDownload(false, handlePreviewReady)}
                disabled={isDecrypting}
                className="btn btn-secondary"
                title="View files in browser without downloading"
              >
                {isDecrypting ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
                <span>Preview Files</span>
              </button>
              <button
                onClick={() => executeDownload(true)}
                disabled={isDecrypting}
                aria-busy={isDecrypting}
                className="btn btn-primary"
              >
                {isDecrypting ? (
                  <>
                    <Loader2 size={16} className="spin" /> Decrypting...
                  </>
                ) : (
                  <>
                    <Lock size={16} /> Save &amp; Download
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
                  onClick={downloadAllFiles}
                >
                  <FolderDown size={14} /> Download All ({decryptedFiles.length})
                </button>
              </div>

              <div className="unpacked-files-list">
                {decryptedFiles.map((file, idx) => (
                  <div key={idx} className="file-item">
                    <div className="file-item-left">
                      <div className="file-icon file-icon--success">
                        {getCategoryIcon(detectFileType(file.name, file.type).category)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="file-item-name">{file.name}</div>
                        <div className="file-item-size">{formatBytes(file.size)}</div>
                      </div>
                    </div>

                    <div className="file-row-actions">
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
                        <Eye size={13} /> Preview
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => downloadSingleFile(file)}
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
                  <strong className="success-file-name">{decryptedFiles[0]?.name || fileInfo.original_name}</strong>
                  <span className="success-file-size">{formatBytes(decryptedFiles[0]?.size || fileInfo.original_size)}</span>
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
              download={decryptedFiles[0]?.name || fileInfo.original_name}
              className="btn btn-primary btn-lg full-width success-download-link"
            >
              <Download size={18} /> Save File to Downloads
            </a>
          )}

          <button className="btn btn-secondary button-block" onClick={handleNewSearch}>
            <RotateCcw size={15} /> Receive Another File
          </button>
        </div>
      )}

      {isBurned && !success && (
        <div className="burn-banner">
          <Flame size={20} className="burn-icon" />
          <div>
            <strong className="burn-title">File Self-Destructed &amp; Purged!</strong>
            <p className="burn-copy">
              The server permanently deleted this file.
            </p>
          </div>
        </div>
      )}

      {/* Universal Preview Modal (Platform-Aware Bottom Sheet on mobile) */}
      {showPreviewModal && activePreviewItem && (
        <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="File Preview">
          <div className="preview-modal">
            <div className="preview-header">
              <h3>
                {getCategoryIcon(activePreviewItem.category)}
                <span>Preview: {activePreviewItem.fileName}</span>
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-primary">
                  <Eye size={12} /> In-Browser
                </span>
                <button className="preview-close" onClick={closeAndRevokePreview} aria-label="Close preview">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Multi-file tab selector */}
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
                <div className="preview-media">
                  {mediaLoading && <PreviewMediaSkeleton height="260px" />}
                  <img
                    src={activePreviewItem.content}
                    alt="Decrypted Preview"
                    className={`preview-image ${mediaLoading ? 'is-hidden' : ''}`}
                    onLoad={() => setMediaLoading(false)}
                    onError={() => setMediaLoading(false)}
                  />
                </div>
              )}

              {/* Video Preview */}
              {activePreviewItem.category === 'video' && (
                <div className="preview-media">
                  {mediaLoading && <PreviewMediaSkeleton height="260px" />}
                  <video
                    src={activePreviewItem.content}
                    controls
                    autoPlay
                    className={`preview-video ${mediaLoading ? 'is-hidden' : ''}`}
                    playsInline
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
                  <Music size={40} className="preview-audio-icon" />
                  <p className="preview-audio-name">{activePreviewItem.fileName}</p>
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
                <div className="preview-pdf-wrapper">
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

              {/* Unsupported binary / Archive / Document card */}
              {!activePreviewItem.canPreviewDirectly && (
                <div className="preview-unsupported-card">
                  <div className="file-icon" style={{ margin: '0 auto 12px auto', width: 48, height: 48 }}>
                    {getCategoryIcon(activePreviewItem.category)}
                  </div>
                  <h4>{activePreviewItem.fileName}</h4>
                  <div style={{ margin: '8px 0' }}>
                    <span className="badge badge-slate" style={{ fontSize: '0.75rem' }}>
                      {activePreviewItem.label || 'File'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', maxWidth: 440, margin: '8px auto', lineHeight: 1.4 }}>
                    {activePreviewItem.description || 'This file format cannot be rendered directly inside web browsers. Please download to open on your device.'}
                  </p>
                  <div style={{ marginTop: 12, padding: '6px 12px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--fg-subtle)' }}>
                    <ShieldCheck size={14} style={{ color: 'var(--success-fg)' }} />
                    <span>Size: {formatBytes(activePreviewItem.fileSize)} &bull; Verified AES-256-GCM Decryption</span>
                  </div>
                </div>
              )}
            </div>

            <div className="preview-footer">
              <button className="btn btn-secondary btn-sm" onClick={closeAndRevokePreview}>
                Done Viewing
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  closeAndRevokePreview();
                  executeDownload(true);
                }}
              >
                <Download size={14} /> Save &amp; Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadPage;
