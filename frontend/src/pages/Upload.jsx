import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft, Loader2, Lock, Trash2 } from 'lucide-react';
import { copyToClipboard } from '../crypto';
import { TransferStateMachine, TransferState } from '../stateMachine';
import { detectFileType } from '../utils/fileType';
import { useFileUpload } from '../hooks/useFileUpload';
import { useEncryptAndSend } from '../hooks/useEncryptAndSend';
import { useP2PSession } from '../hooks/useP2PSession';
import { ErrorAlert } from '../components/FeedbackStates';

import { DropZone } from '../components/upload/DropZone';
import { SingleFileCard } from '../components/upload/SingleFileCard';
import { TransferQueueList } from '../components/upload/TransferQueueList';
import { CapacityBar } from '../components/upload/CapacityBar';
import { VaultSettings } from '../components/upload/VaultSettings';
import { TransferProgress } from '../components/upload/TransferProgress';
import { TransferConfirmModal } from '../components/upload/TransferConfirmModal';
import { LocalFilePreviewModal } from '../components/upload/LocalFilePreviewModal';
import { FeatureGuideModal } from '../components/upload/FeatureGuideModal';
import { ShareResultCard } from '../components/upload/ShareResultCard';

/**
 * Upload Page Orchestrator Component
 * Primary Responsibility: Manage state for upload workflows, orchestrating file selection, options, modals, and upload progression.
 */
function UploadPage() {
  const navigate = useNavigate();
  const [stateMachine] = useState(() => new TransferStateMachine(TransferState.IDLE));
  const [currentState, setCurrentState] = useState(TransferState.IDLE);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [copied, setCopied] = useState(false);

  // Advanced Details & Custom Settings state
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [showCustomOverride, setShowCustomOverride] = useState(false);

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

  const fileInputRef = useRef(null);
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
    isOverLimit,
    batchAnalysis,
    singleFileOptimization,
    customSettings,
    isSmartOptimized,
    updateCustomSettings,
    resetToSmartDefaults,
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
    stateMachine.onStateChange = ({ currentState: nextState, userMessage }) => {
      setCurrentState(nextState);
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
    if (num !== 1 && burnOnRead) {
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
        totalSelectedSize,
        customSettings
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
    setShowAdvancedDetails(false);
    setShowCustomOverride(false);
    stateMachine.transitionTo(TransferState.IDLE);
  };

  const handleOpenLocalPreview = (fileObj) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(fileObj);
    const detection = detectFileType(fileObj.name, fileObj.type);

    if (
      detection.category === 'image' ||
      detection.category === 'video' ||
      detection.category === 'audio' ||
      detection.category === 'pdf'
    ) {
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
          if (detection.category === 'text' || nonPrintableCount / (sample.length || 1) < 0.05) {
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

  const currentOpt =
    singleFileOptimization || (batchAnalysis.files.length > 0 ? batchAnalysis.files[0] : null);

  return (
    <div className="page-container animate-in">
      <button className="btn btn-secondary btn-sm back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={15} /> Back to Home
      </button>

      <div className="page-header">
        <h2><Upload size={22} /> Send Files</h2>
        <p>Drop your file(s) below. Automatically analyzed and optimized for highest speed and zero-knowledge encryption.</p>
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
          <DropZone
            files={files}
            isDragging={isDragging}
            totalSelectedSize={totalSelectedSize}
            supportsMultiple={supportsMultiple}
            fileInputRef={fileInputRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
          />

          {files.length > 0 && (
            <div className="file-info animate-in">
              <div className="file-section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h4 className="file-section-heading" style={{ marginBottom: 0 }}>
                    {files.length === 1 ? 'Selected File' : `Transfer Queue (${files.length} files)`}
                  </h4>
                  {isSmartOptimized ? (
                    <span className="smart-badge-pill">
                      ✓ Smart Optimized
                    </span>
                  ) : (
                    <span className="smart-badge-pill badge-custom">
                      ⚙ Custom Configuration
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAll}
                  disabled={isTransferring}
                >
                  <Trash2 size={13} /> Clear All
                </button>
              </div>

              {/* Single File Card */}
              {files.length === 1 && currentOpt && (
                <SingleFileCard
                  file={files[0]}
                  currentOpt={currentOpt}
                  isTransferring={isTransferring}
                  showAdvancedDetails={showAdvancedDetails}
                  setShowAdvancedDetails={setShowAdvancedDetails}
                  showCustomOverride={showCustomOverride}
                  setShowCustomOverride={setShowCustomOverride}
                  customSettings={customSettings}
                  updateCustomSettings={updateCustomSettings}
                  resetToSmartDefaults={resetToSmartDefaults}
                  onOpenPreview={handleOpenLocalPreview}
                  onRemoveFile={() => removeFile(0)}
                />
              )}

              {/* Multiple Files Card & Queue Table */}
              {files.length > 1 && (
                <TransferQueueList
                  files={files}
                  totalSelectedSize={totalSelectedSize}
                  batchAnalysis={batchAnalysis}
                  isTransferring={isTransferring}
                  showAdvancedDetails={showAdvancedDetails}
                  setShowAdvancedDetails={setShowAdvancedDetails}
                  onOpenPreview={handleOpenLocalPreview}
                  onRemoveFile={removeFile}
                />
              )}

              <CapacityBar
                totalSelectedSize={totalSelectedSize}
                isOverLimit={isOverLimit}
              />

              <VaultSettings
                burnOnRead={burnOnRead}
                onBurnToggle={handleBurnToggle}
                useSteganography={useSteganography}
                setUseSteganography={setUseSteganography}
                useP2P={useP2P}
                setUseP2P={setUseP2P}
                maxDownloads={maxDownloads}
                onMaxDownloadsChange={handleMaxDownloadsChange}
                expiryHours={expiryHours}
                setExpiryHours={setExpiryHours}
                isTransferring={isTransferring}
                onOpenGuide={() => setShowGuideModal(true)}
              />

              <TransferProgress
                progress={progress}
                files={files}
                totalSelectedSize={totalSelectedSize}
                statusMessage={statusMessage}
              />

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
                      <Lock size={18} /> {files.length > 1 ? `Send All (${files.length} files)` : 'Send File'}
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

      <TransferConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmedSend}
        files={files}
        totalSelectedSize={totalSelectedSize}
        isSmartOptimized={isSmartOptimized}
        currentOpt={currentOpt}
        useSteganography={useSteganography}
        burnOnRead={burnOnRead}
        maxDownloads={maxDownloads}
        expiryHours={expiryHours}
      />

      <LocalFilePreviewModal
        previewFile={previewFile}
        previewUrl={previewUrl}
        previewText={previewText}
        onClose={handleCloseLocalPreview}
      />

      <FeatureGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

      <ShareResultCard
        result={result}
        shareUrl={shareUrl}
        useP2P={useP2P}
        p2pState={p2pState}
        p2pStatus={p2pStatus}
        stegoSkipped={stegoSkipped}
        expiryHours={expiryHours}
        copied={copied}
        refreshCount={refreshCount}
        isRefreshingToken={isRefreshingToken}
        refreshLimitReached={refreshLimitReached}
        onRefreshQRToken={refreshQRToken}
        onCopyCode={handleCopyCode}
        onClearAll={handleClearAll}
        onCancelTransfer={async () => {
          const ok = await cancelTransfer();
          if (ok) handleClearAll();
        }}
      />
    </div>
  );
}

export default UploadPage;
