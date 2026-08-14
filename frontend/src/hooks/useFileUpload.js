/**
 * Custom hook for file selection, validation, and file list management.
 * (LLD: File Manager Hook)
 */

import { useState, useCallback } from 'react';
import { validateFiles, MAX_TOTAL_TRANSFER_SIZE } from '../fileManager';
import { TransferState } from '../stateMachine';

export function useFileUpload(stateMachine) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);

  const calculateTotalSize = useCallback((fileList = files) => {
    return fileList.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [files]);

  const addFiles = useCallback((newFiles) => {
    const rawNew = Array.from(newFiles || []);
    if (rawNew.length === 0) return;

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

  return {
    files,
    isDragging,
    error,
    setError,
    totalSelectedSize,
    remainingCapacity,
    isOverLimit,
    addFiles,
    removeFile,
    clearFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
}
