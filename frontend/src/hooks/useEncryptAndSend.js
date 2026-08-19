/**
 * Custom hook for encryption, steganography embedding, upload transmission, and QR refresh.
 * (LLD: Transfer Manager - Sender Hook) with Smart Transfer Optimization integration.
 */

import { useState, useCallback } from 'react';
import { encryptFile, createTransferCode, buildChunkMarker, computeAccessProof } from '../crypto';
import { packFiles } from '../fileManager';
import { SmartTransferOptimizer } from '../services/smartTransferOptimizer';
import { embedPayloadInImage } from '../steganography';
import { api } from '../services/api';
import { createProgressThrottle } from '../services/progress';
import { TransferState } from '../stateMachine';

const STEGO_MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REFRESHES = 5;

export function useEncryptAndSend(stateMachine) {
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [stegoSkipped, setStegoSkipped] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [refreshLimitReached, setRefreshLimitReached] = useState(false);
  const [error, setError] = useState(null);

  const sendFiles = useCallback(async ({
    files,
    useSteganography,
    burnOnRead,
    expiryHours,
    maxDownloads = 10,
    totalSelectedSize,
    customSettings = null
  }) => {
    if (!files || files.length === 0) return;

    stateMachine?.transitionTo(TransferState.PREPARE);
    setError(null);

    const smartAnalysis = SmartTransferOptimizer.analyzeBatch(files);
    const primarySmart = files.length === 1 ? SmartTransferOptimizer.analyzeFile(files[0]) : null;

    let startTime = Date.now();
    let lastBytes = 0;
    let lastTime = Date.now();

    const updateProgressWithMetrics = (stage, percent, currentBytes = null) => {
      const now = Date.now();
      const bytes = currentBytes !== null ? currentBytes : Math.round((percent / 100) * totalSelectedSize);
      const timeDelta = (now - lastTime) / 1000;
      let speed = 0;

      if (timeDelta >= 0.3) {
        speed = Math.round((bytes - lastBytes) / timeDelta);
        lastBytes = bytes;
        lastTime = now;
      }

      const remainingBytes = Math.max(0, totalSelectedSize - bytes);
      const etaSeconds = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

      return {
        stage,
        percent,
        transferredBytes: bytes,
        totalBytes: totalSelectedSize,
        speedBytesPerSec: speed,
        etaSeconds,
        mode: primarySmart ? primarySmart.mode : 'Standard',
        isSmartOptimized: !customSettings,
        fileCount: files.length,
        currentFileName: files[0]?.name || 'transfer'
      };
    };

    setProgress(updateProgressWithMetrics('reading', 2, 0));
    const throttle = createProgressThrottle(setProgress);

    try {
      stateMachine?.transitionTo(TransferState.PROCESSING);

      // Package files: single file directly, or multi-file binary bundle
      const packaged = await packFiles(files);
      const targetBlob = packaged.blob;

      const encrypted = await encryptFile(targetBlob, (p) => {
        const prog = updateProgressWithMetrics(
          p.stage,
          Math.min(85, p.percent || 10),
          Math.round(((p.percent || 10) / 100) * totalSelectedSize)
        );
        throttle.push(prog);
      });
      throttle.flush();

      let uploadBlob = encrypted.encryptedBlob;
      let uploadFileName = packaged.name + '.encrypted';

      if (useSteganography) {
        throttle.push(updateProgressWithMetrics('steganography', 75));
        if (encrypted.encryptedSize > STEGO_MAX_PAYLOAD_BYTES) {
          setStegoSkipped(true);
        } else {
          try {
            const payloadArrayBuffer = await encrypted.encryptedBlob.arrayBuffer();
            const payloadBytes = new Uint8Array(payloadArrayBuffer);
            uploadBlob = await embedPayloadInImage(null, payloadBytes);
            uploadFileName = 'vault_' + Date.now() + '.png';
          } catch (stegoErr) {
            console.warn('Steganography skipped:', stegoErr.message);
            setStegoSkipped(true);
          }
        }
      }

      stateMachine?.transitionTo(TransferState.CREATING_TRANSFER);
      throttle.push(updateProgressWithMetrics('uploading', 88));

      const effectiveMaxDownloads = Number(maxDownloads);

      const uploadMetadata = {
        filename: uploadFileName,
        original_name: packaged.name,
        original_size: encrypted.originalSize,
        iv: encrypted.iv,
        salt: encrypted.salt,
        compressed: encrypted.compressed ? '1' : '0',
        max_downloads: effectiveMaxDownloads.toString(),
        burn_on_read: burnOnRead ? '1' : '0',
        expiry_hours: expiryHours.toString(),
        sharing_mode: useSteganography && burnOnRead ? 'both' : useSteganography ? 'steganography' : burnOnRead ? 'burn_on_read' : 'standard',
        checksum: buildChunkMarker(encrypted.chunked),
        access_hash: await computeAccessProof(encrypted.password)
      };

      const data = await api.uploadSmart(uploadBlob, uploadMetadata, (p) => {
        const uploadPercent = 88 + Math.round(p.percent * 0.12);
        throttle.push(updateProgressWithMetrics('uploading', uploadPercent, Math.round((uploadPercent / 100) * totalSelectedSize)));
      });

      const transferCode = createTransferCode(data.file_id, encrypted.password);

      if (data.owner_token && data.file_id) {
        try {
          sessionStorage.setItem(`fs_owner_${data.file_id}`, data.owner_token);
        } catch (_) {}
      }

      const shareReference = `FS-${data.file_id.toUpperCase()}`;
      let bestUrl = `${window.location.origin}/download?code=${encodeURIComponent(shareReference)}#key=${encodeURIComponent(encrypted.password)}`;
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        try {
          const netData = await api.networkInfo();
          const lanIp = (netData.local_ips || []).find(ip => ip !== '127.0.0.1' && !ip.startsWith('127.'));
          if (lanIp) {
            const portStr = window.location.port ? `:${window.location.port}` : '';
            bestUrl = `http://${lanIp}${portStr}/download?code=${encodeURIComponent(shareReference)}#key=${encodeURIComponent(encrypted.password)}`;
          }
        } catch (e) {
          console.warn("Failed to fetch network info for LAN sharing URL:", e);
        }
      }

      setShareUrl(bestUrl);
      setRefreshCount(0);
      setRefreshLimitReached(false);
      stateMachine?.transitionTo(TransferState.WAITING_FOR_RECEIVER);
      throttle.push(updateProgressWithMetrics('complete', 100, totalSelectedSize));
      throttle.flush();

      setResult({
        fileId: data.file_id,
        transferId: data.transfer_id || data.file_id,
        transferCode,
        expiresAt: data.expires_at,
        originalSize: totalSelectedSize,
        fileCount: files.length,
        isBundle: packaged.isBundle,
        fileList: packaged.fileList,
        isBurn: burnOnRead,
        maxDownloads: effectiveMaxDownloads,
        expiryHours,
        ownerToken: data.owner_token || null,
        smartOptimization: primarySmart || smartAnalysis,
        isSmartOptimized: !customSettings
      });
    } catch (err) {
      const status = err.status;
      const msg = (err.message || '').toLowerCase();
      let friendly = err.message || 'Something went wrong while uploading. Please try again.';
      if (status === 429) friendly = 'Too many uploads. Please wait a moment and retry.';
      else if (status === 413 || msg.includes('2 gb') || msg.includes('payload too large') || msg.includes('maximum allowed size') || msg.includes('request entity too large')) {
        friendly = 'File exceeds the server upload limit. Please select smaller files, or enable the "WebRTC Direct P2P" toggle to send unlimited file sizes directly.';
      } else if (msg.includes('network') || msg.includes('failed to fetch')) {
        friendly = 'Network error during upload. Check your connection and retry.';
      }
      setError(friendly);
      stateMachine?.transitionTo(TransferState.FAILED);
      setProgress(null);
    } finally {
      throttle.dispose();
    }
  }, [stateMachine]);

  const refreshQRToken = useCallback(async () => {
    if (!result || isRefreshingToken || refreshLimitReached) return;

    if (refreshCount >= MAX_REFRESHES) {
      setRefreshLimitReached(true);
      setError("QR refresh limit reached. Generate a new transfer.");
      return;
    }

    setIsRefreshingToken(true);
    try {
      const res = await api.refreshToken(result.transferId).catch((err) => {
        if (err.status === 429) return { _limited: true };
        throw err;
      });
      if (res && res._limited) {
        setRefreshLimitReached(true);
        setError("QR refresh limit reached. Generate a new transfer.");
        return;
      }
      setRefreshCount(res.refresh_count);
      if (res.refresh_count >= MAX_REFRESHES) {
        setRefreshLimitReached(true);
      }
    } catch (err) {
      console.warn("QR refresh network error:", err);
    } finally {
      setIsRefreshingToken(false);
    }
  }, [result, isRefreshingToken, refreshLimitReached, refreshCount]);

  const resetSendState = useCallback(() => {
    setProgress(null);
    setResult(null);
    setShareUrl('');
    setStegoSkipped(false);
    setRefreshCount(0);
    setRefreshLimitReached(false);
    setError(null);
  }, []);

  const cancelTransfer = useCallback(async () => {
    if (!result?.fileId || !result.ownerToken) return false;
    try {
      await api.deleteFile(result.fileId, result.ownerToken);
      try {
        sessionStorage.removeItem(`fs_owner_${result.fileId}`);
      } catch (_) {}
      return true;
    } catch (err) {
      setError(err.status === 403
        ? 'Could not cancel this transfer from this browser tab.'
        : (err.message || 'Could not cancel the transfer.'));
      return false;
    }
  }, [result]);

  return {
    progress,
    result,
    shareUrl,
    stegoSkipped,
    refreshCount,
    isRefreshingToken,
    refreshLimitReached,
    error,
    sendFiles,
    refreshQRToken,
    cancelTransfer,
    resetSendState
  };
}
