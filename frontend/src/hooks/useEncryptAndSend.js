/**
 * Custom hook for encryption, steganography embedding, upload transmission, and QR refresh.
 * (LLD: Transfer Manager - Sender Hook)
 */

import { useState, useCallback } from 'react';
import { encryptFile, createTransferCode, buildChunkMarker, computeAccessProof } from '../crypto';
import { packFiles } from '../fileManager';
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

  const sendFiles = useCallback(async ({ files, useSteganography, burnOnRead, expiryHours, maxDownloads = 10, totalSelectedSize }) => {
    if (!files || files.length === 0) return;

    stateMachine?.transitionTo(TransferState.PREPARE);
    setError(null);
    setProgress({ stage: 'reading', percent: 2 });
    const throttle = createProgressThrottle(setProgress);

    try {
      stateMachine?.transitionTo(TransferState.PROCESSING);

      // Package files: single file directly, or multi-file binary bundle
      const packaged = await packFiles(files);
      const targetBlob = packaged.blob;

      const encrypted = await encryptFile(targetBlob, (p) => throttle.push(p));
      throttle.flush();

      let uploadBlob = encrypted.encryptedBlob;
      let uploadFileName = packaged.name + '.encrypted';

      if (useSteganography) {
        throttle.push({ stage: 'steganography', percent: 75 });
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
      throttle.push({ stage: 'uploading', percent: 88 });

      const effectiveMaxDownloads = burnOnRead ? 1 : Number(maxDownloads);

      const formData = new FormData();
      formData.append('file', uploadBlob, uploadFileName);
      formData.append('iv', encrypted.iv);
      formData.append('salt', encrypted.salt);
      formData.append('original_name', packaged.name);
      formData.append('original_size', encrypted.originalSize);
      formData.append('compressed', encrypted.compressed ? '1' : '0');
      formData.append('max_downloads', effectiveMaxDownloads.toString());
      formData.append('burn_on_read', burnOnRead ? '1' : '0');
      formData.append('expiry_hours', expiryHours.toString());
      formData.append('sharing_mode', useSteganography && burnOnRead ? 'both' : useSteganography ? 'steganography' : burnOnRead ? 'burn_on_read' : 'standard');
      // Server-stored format marker for chunked ciphertext
      formData.append('checksum', buildChunkMarker(encrypted.chunked));
      formData.append('access_hash', await computeAccessProof(encrypted.password));

      const data = await api.upload(formData, (p) => {
        throttle.push({ stage: 'uploading', percent: 88 + Math.round(p.percent * 0.12) });
      });

      const transferCode = createTransferCode(data.file_id, encrypted.password);

      if (data.owner_token && data.file_id) {
        try {
          sessionStorage.setItem(`fs_owner_${data.file_id}`, data.owner_token);
        } catch (_) {}
      }

      // The key stays in the URL fragment: browsers never send fragments to servers,
      // proxies, analytics, or access logs. The visible transfer code remains available
      // for people who prefer copying it into a chat.
      const shareReference = `FS-${data.file_id.toUpperCase()}`;
      let bestUrl = `${window.location.origin}/download?code=${encodeURIComponent(shareReference)}#key=${encodeURIComponent(encrypted.password)}`;
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        try {
          const netData = await api.networkInfo();
          const lanIp = (netData.local_ips || []).find(ip => ip !== '127.0.0.1' && !ip.startsWith('127.'));
          if (lanIp) {
            bestUrl = `http://${lanIp}:5173/download?code=${encodeURIComponent(shareReference)}#key=${encodeURIComponent(encrypted.password)}`;
          }
        } catch (e) {
          console.warn("Failed to fetch network info for LAN sharing URL:", e);
        }
      }

      setShareUrl(bestUrl);
      setRefreshCount(0);
      setRefreshLimitReached(false);
      stateMachine?.transitionTo(TransferState.WAITING_FOR_RECEIVER);
      throttle.push({ stage: 'complete', percent: 100 });
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
      });
    } catch (err) {
      const status = err.status;
      const msg = (err.message || '').toLowerCase();
      let friendly = err.message || 'Something went wrong while uploading. Please try again.';
      if (status === 429) friendly = 'Too many uploads. Please wait a moment and retry.';
      else if (status === 413 || msg.includes('2 gb')) friendly = 'Upload exceeds the 2 GB limit.';
      else if (msg.includes('network') || msg.includes('failed to fetch')) friendly = 'Network error during upload. Check your connection and retry.';
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
