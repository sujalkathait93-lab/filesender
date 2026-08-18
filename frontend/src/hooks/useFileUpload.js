/**
 * Custom hook for file selection, validation, smart transfer optimization, and queue management.
 * (LLD: File Manager Hook)
 */

import { useState, useCallback, useMemo } from 'react';
import { validateFiles, MAX_TOTAL_TRANSFER_SIZE } from '../fileManager';
import { SmartTransferOptimizer, MAX_FILE_SIZE_BYTES } from '../services/smartTransferOptimizer';
import { TransferState } from '../stateMachine';

export function useFileUpload(stateMachine) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [customSettings, setCustomSettings] = useState(null); // Optional manual override

  const calculateTotalSize = useCallback((fileList = files) => {
    return fileList.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [files]);

  const addFiles = useCallback((newFiles) => {
    const rawNew = Array.from(newFiles || []);
    if (rawNew.length === 0) return;

    // Immediate individual file validation (1 GB max)
    for (const f of rawNew) {
      const singleValidation = SmartTransferOptimizer.validateFile(f);
      if (!singleValidation.valid) {
        setError(singleValidation.error);
        stateMachine?.transitionTo(TransferState.SELECT);
        return;
      }
    }

    const combined = [...files, ...rawNew];
    const validation = validateFiles(combined);

    if (!validation.valid) {
      setError(validation.error);
      stateMachine?.transitionTo(TransferState.SELECT);
      return;
    }

    setError(null);
    setFiles(combined);
    stateMachine?.transitionTo(TransferState.SELECT);
  }, [files, stateMachine]);

  const removeFile = useCallback((indexToRemove) => {
    const updated = files.filter((_, idx) => idx !== indexToRemove);
    setFiles(updated);
    if (updated.length === 0) {
      setError(null);
      setCustomSettings(null);
      stateMachine?.transitionTo(TransferState.IDLE);
    } else {
      const validation = validateFiles(updated);
      if (!validation.valid) setError(validation.error);
      else setError(null);
    }
  }, [files, stateMachine]);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
    setCustomSettings(null);
  }, []);

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

    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    if (droppedFiles.length === 0) return;

    addFiles(droppedFiles);
  }, [addFiles]);

  const totalSelectedSize = calculateTotalSize();
  const remainingCapacity = Math.max(0, MAX_TOTAL_TRANSFER_SIZE - totalSelectedSize);
  const isOverLimit = totalSelectedSize > MAX_TOTAL_TRANSFER_SIZE;

  // Batch-level Smart Optimization Analysis
  const batchAnalysis = useMemo(() => {
    return SmartTransferOptimizer.analyzeBatch(files);
  }, [files]);

  // Primary Single File Optimization Analysis (if single file selected)
  const singleFileOptimization = useMemo(() => {
    if (files.length === 1) {
      const base = SmartTransferOptimizer.analyzeFile(files[0]);
      if (customSettings) {
        return {
          ...base,
          mode: customSettings.mode || base.mode,
          chunkSize: customSettings.chunkSize !== undefined ? customSettings.chunkSize : base.chunkSize,
          chunkSizeLabel: customSettings.chunkSizeLabel || base.chunkSizeLabel,
          bufferLevel: customSettings.bufferLevel || base.bufferLevel,
          maxParallelism: customSettings.maxParallelism || base.maxParallelism,
          isSmartOptimized: false,
          customOverridden: true
        };
      }
      return base;
    }
    return null;
  }, [files, customSettings]);

  const updateCustomSettings = useCallback((settings) => {
    setCustomSettings(settings);
  }, []);

  const resetToSmartDefaults = useCallback(() => {
    setCustomSettings(null);
  }, []);

  return {
    files,
    isDragging,
    error,
    setError,
    totalSelectedSize,
    remainingCapacity,
    isOverLimit,
    batchAnalysis,
    singleFileOptimization,
    customSettings,
    isSmartOptimized: !customSettings,
    updateCustomSettings,
    resetToSmartDefaults,
    addFiles,
    removeFile,
    clearFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
}
