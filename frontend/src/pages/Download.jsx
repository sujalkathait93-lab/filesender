import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, Search, Flame, ShieldAlert } from 'lucide-react';
import { parseTransferCode, extractKeyFromUrl } from '../crypto';
import { TransferStateMachine, TransferState } from '../stateMachine';
import { PreviewManager } from '../previewManager';
import { useDownload } from '../hooks/useDownload';
import { useP2PSession } from '../hooks/useP2PSession';
import { FileInfoSkeleton } from '../components/Skeletons';
import { EmptyState, ErrorAlert } from '../components/FeedbackStates';

import { CodeSearchInput } from '../components/download/CodeSearchInput';
import { DownloadFileCard } from '../components/download/DownloadFileCard';
import { DecryptedFilesList } from '../components/download/DecryptedFilesList';
import { FilePreviewModal } from '../components/download/FilePreviewModal';
import { ExpiredFileCard } from '../components/download/ExpiredFileCard';

/**
 * Download Page Orchestrator Component
 * Primary Responsibility: Manage state for download workflows, orchestrating 10-digit code search, decrypting, previewing, and saving.
 */
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
    isExpired,
    expiredReason,
    expiredMessage,
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
    stateMachine.onStateChange = ({ currentState: nextState, userMessage }) => {
      setCurrentState(nextState);
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
  }, [urlFileId, searchCode]);

  const closeAndRevokePreview = useCallback(() => {
    setShowPreviewModal(false);
    if (previewManagerRef.current) {
      previewManagerRef.current.close();
    }
    setActivePreviewItem(null);
  }, []);

  const handleSearchCode = (targetCode, targetKey = null) => {
    if (searchInFlightRef.current || isLoading) return;
    const target = (targetCode || codeInput || '').trim();
    if (!target) return;
    const parsed = parseTransferCode(target);
    const keyToUse = targetKey || parsed.key;
    searchInFlightRef.current = true;
    searchCode(target, keyToUse).finally(() => {
      searchInFlightRef.current = false;
    });
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const val = text.trim();
        const parsed = parseTransferCode(val);
        const codeDisplay = parsed.valid && parsed.fileId && parsed.key
          ? `FS-${parsed.fileId.toUpperCase()}-${parsed.key.toUpperCase()}`
          : val;
        setCodeInput(codeDisplay);
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

  const handleOpenBundlePreview = (file, index) => {
    if (!previewManagerRef.current) return;
    const prepared = previewManagerRef.current.preparePreview(file);
    setActivePreviewItem(prepared);
    setPreviewBundleFiles(decryptedFiles);
    setActivePreviewIndex(index);
    setShowPreviewModal(true);
  };

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary btn-sm back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={15} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Download size={22} /> Receive Files</h2>
        <p>Enter your 10-digit transfer code below to connect, inspect file details, preview, and download.</p>
      </div>

      <CodeSearchInput
        codeInput={codeInput}
        onChangeCodeInput={setCodeInput}
        onSearchCode={handleSearchCode}
        onPasteClipboard={handlePasteClipboard}
        isLoading={isLoading}
        isDecrypting={isDecrypting}
      />

      {/* Loading Skeletons */}
      {isLoading && <FileInfoSkeleton />}

      {/* Expired / Limit Reached / Burned State */}
      {isExpired && !isLoading && (
        <ExpiredFileCard
          reason={expiredReason}
          customMessage={expiredMessage}
          onNewSearch={handleNewSearch}
        />
      )}

      {/* General Error state (only if not expired) */}
      {error && !isLoading && !isExpired && (
        <ErrorAlert
          message={error}
          onRetry={codeInput ? () => handleSearchCode(codeInput) : null}
        />
      )}

      {/* Empty State when idle */}
      {!fileInfo && !isLoading && !error && !isExpired && !success && !isBurned && (
        <EmptyState
          icon={Search}
          title="No active transfer selected"
          description="Enter a 10-digit transfer code from the sender to connect, inspect file details, preview, and download."
          actionText="Paste from Clipboard"
          onAction={handlePasteClipboard}
        />
      )}

      {/* Active Download Details Card */}
      {fileInfo && !success && !isExpired && (
        <DownloadFileCard
          fileInfo={fileInfo}
          isBurned={isBurned}
          p2pStatus={p2pStatus}
          p2pState={p2pState}
          needsKey={needsKey}
          manualKey={manualKey}
          setManualKey={setManualKey}
          progress={progress}
          isDecrypting={isDecrypting}
          statusMessage={statusMessage}
          onExecuteDownload={executeDownload}
          onPreviewReady={handlePreviewReady}
        />
      )}

      {/* Successfully Decrypted Files */}
      {success && fileInfo && (
        <DecryptedFilesList
          decryptedFiles={decryptedFiles}
          fileInfo={fileInfo}
          isBurned={isBurned}
          decryptedBlobUrl={decryptedBlobUrl}
          onDownloadSingleFile={downloadSingleFile}
          onDownloadAllFiles={downloadAllFiles}
          onOpenPreview={handleOpenBundlePreview}
          onNewSearch={handleNewSearch}
        />
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={showPreviewModal}
        activePreviewItem={activePreviewItem}
        previewBundleFiles={previewBundleFiles}
        activePreviewIndex={activePreviewIndex}
        mediaLoading={mediaLoading}
        setMediaLoading={setMediaLoading}
        onSelectPreviewFile={handleSelectPreviewFile}
        onClose={closeAndRevokePreview}
        onDownloadAndClose={() => {
          closeAndRevokePreview();
          executeDownload(true);
        }}
      />
    </div>
  );
}

export default DownloadPage;
