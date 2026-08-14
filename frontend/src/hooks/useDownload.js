/**
 * Custom hook for downloading, decrypting, and processing received files.
 * (LLD: Transfer Manager - Receiver Hook)
 */

import { useState, useRef, useCallback } from 'react';
import { decryptFile, extractKeyFromUrl, parseTransferCode, isChunkedMarker } from '../crypto';
import { unpackFiles } from '../fileManager';
import { extractPayloadFromImage } from '../steganography';
import { api } from '../services/api';
import { createProgressThrottle } from '../services/progress';
import { TransferState } from '../stateMachine';

/** Cheap guard: only attempt stego extraction for actual PNG files. */
async function isPngBlob(blob) {
  try {
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    return head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  } catch (_) {
    return false;
  }
}

export function useDownload(stateMachine) {
  const [fileInfo, setFileInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isBurned, setIsBurned] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const [decryptedFiles, setDecryptedFiles] = useState([]);
  const [decryptedBlobUrl, setDecryptedBlobUrl] = useState(null);

  const searchInFlightRef = useRef(false);

  const fetchServerFileInfo = useCallback(async (id, activeKey) => {
    try {
      const data = await api.fileInfo(id);
      setFileInfo(data);
      setNeedsKey(!activeKey);
      stateMachine?.transitionTo(TransferState.DOWNLOAD);
    } catch (err) {
      if (err.status === 410) {
        setIsBurned(true);
        setError('This file has self-destructed and is permanently unavailable.');
        stateMachine?.transitionTo(TransferState.EXPIRED);
      } else if (err.status === 404) {
        setError('Transfer session not found or expired. Please check the code.');
        stateMachine?.transitionTo(TransferState.FAILED);
      } else {
        setError('Could not reach server. Please check your network connection.');
        stateMachine?.transitionTo(TransferState.FAILED);
      }
    }
  }, [stateMachine]);

  const searchCode = useCallback(async (codeInput, targetKey = null) => {
    if (searchInFlightRef.current) return;
    const code = (codeInput || '').trim();
    if (!code) return;

    const parsed = parseTransferCode(code);
    const activeKey = targetKey || parsed.key || extractKeyFromUrl();
    setManualKey(activeKey || '');

    searchInFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    setIsBurned(false);
    setFileInfo(null);
    setSuccess(false);
    setProgress(null);
    setDecryptedFiles([]);
    stateMachine?.transitionTo(TransferState.CONNECT);

    if (!parsed.fileId) {
      setError('Invalid transfer code format. Please check and try again.');
      stateMachine?.transitionTo(TransferState.INVALID_TOKEN);
      searchInFlightRef.current = false;
      setIsLoading(false);
      return;
    }

    await fetchServerFileInfo(parsed.fileId, activeKey);

    searchInFlightRef.current = false;
    setIsLoading(false);
  }, [fetchServerFileInfo, stateMachine]);

  const executeDownload = useCallback(async (triggerBrowserSave = true, onPreviewDataReady = null) => {
    if (!fileInfo) return;

    const key = manualKey.trim() || extractKeyFromUrl();
    if (!key) {
      setNeedsKey(true);
      setError('Decryption key required. Please paste the decryption key.');
      return;
    }

    setIsDecrypting(true);
    setError(null);
    stateMachine?.transitionTo(TransferState.TRANSFER);
    setProgress({ stage: 'downloading', percent: 8 });
    const throttle = createProgressThrottle(setProgress);

    try {
      const { blob, headers } = await api.download(fileInfo.id, {
        preview: !triggerBrowserSave,
        onProgress: (received, total) => {
          throttle.push({ stage: 'downloading', percent: 8 + Math.round((received / total) * 55) });
        },
      });

      if (headers.isBurn && triggerBrowserSave) {
        setIsBurned(true);
      }

      stateMachine?.transitionTo(TransferState.VERIFY);
      throttle.push({ stage: 'decrypting', percent: 68 });

      // Only attempt stego extraction for actual PNG vault files
      let encryptedPayloadBlob = blob;
      if (await isPngBlob(blob)) {
        try {
          const extractedBytes = await extractPayloadFromImage(blob);
          encryptedPayloadBlob = new Blob([extractedBytes]);
          throttle.push({ stage: 'steganography_extracted', percent: 76 });
        } catch (_) {}
      }

      const chunked = isChunkedMarker(fileInfo.checksum);
      const decryptedData = await decryptFile(
        encryptedPayloadBlob,
        key,
        fileInfo.iv,
        fileInfo.salt,
        (p) => {
          const basePercent = p.stage === 'complete' ? 100 : 76 + Math.round(p.percent * 0.24);
          throttle.push({ stage: p.stage, percent: basePercent });
        },
        chunked
      );
      throttle.flush();

      // Unpack files (handles single file or multi-file bundle)
      const unpacked = unpackFiles(decryptedData, fileInfo.original_name, fileInfo.mime_type);
      setDecryptedFiles(unpacked.files);

      if (!triggerBrowserSave && onPreviewDataReady) {
        stateMachine?.transitionTo(TransferState.PREVIEW);
        onPreviewDataReady(unpacked.files[0], unpacked);
      } else if (triggerBrowserSave) {
        stateMachine?.transitionTo(TransferState.COMPLETE);
        // Trigger browser save for each unpacked file
        for (const file of unpacked.files) {
          const url = window.URL.createObjectURL(file.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => {
            try { window.URL.revokeObjectURL(url); } catch (_) {}
          }, 1000);
        }

        // Also save primary URL for download card
        const primaryBlob = unpacked.files[0].blob;
        const primaryUrl = window.URL.createObjectURL(primaryBlob);
        setDecryptedBlobUrl(primaryUrl);
        setSuccess(true);
      }

      setProgress({ stage: 'complete', percent: 100 });
    } catch (err) {
      if (!isBurned) {
        setError(err.message || 'Decryption failed. Please check the code/key.');
      }
      stateMachine?.transitionTo(TransferState.FAILED);
      setProgress(null);
    } finally {
      setIsDecrypting(false);
      throttle.dispose();
    }
  }, [fileInfo, manualKey, isBurned, stateMachine]);

  const resetDownloadState = useCallback(() => {
    revokeDecryptedUrl();
    setFileInfo(null);
    setError(null);
    setSuccess(false);
    setIsBurned(false);
    setProgress(null);
    setManualKey('');
    setNeedsKey(false);
    setDecryptedFiles([]);
  }, []);

  /** Revoke the object URL of a decrypted file (frees browser memory). */
  const revokeDecryptedUrl = useCallback(() => {
    setDecryptedBlobUrl((current) => {
      if (current) {
        try { window.URL.revokeObjectURL(current); } catch (_) {}
      }
      return null;
    });
  }, []);

  return {
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
  };
}
