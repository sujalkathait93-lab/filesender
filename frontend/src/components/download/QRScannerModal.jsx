import React, { useState, useEffect, useRef } from 'react';
import { QrCode, X, Camera, Image as ImageIcon, AlertTriangle, RefreshCw, Check } from 'lucide-react';

/**
 * QRScannerModal Component
 * Primary Responsibility: Live camera QR code scanner with image file upload fallback.
 */
export function QRScannerModal({ isOpen, onClose, onCodeDetected }) {
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return undefined;
    }

    startCamera();

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      stopCamera();
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false);
      setCameraError('Camera access is not supported by your browser. You can upload a QR image instead.');
      setIsScanning(false);
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanVideoFrame();
      }
    } catch (err) {
      setCameraError('Unable to access camera. Please allow camera permissions or upload a QR image.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const scanVideoFrame = async () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    // Try native BarcodeDetector if available
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            handleSuccessfulScan(rawValue);
            return;
          }
        }
      } catch (_) {}
    }

    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  const handleSuccessfulScan = (code) => {
    stopCamera();
    onCodeDetected(code);
    onClose();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ('BarcodeDetector' in window) {
      try {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        await img.decode();

        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(img);
        URL.revokeObjectURL(url);

        if (barcodes.length > 0 && barcodes[0].rawValue) {
          handleSuccessfulScan(barcodes[0].rawValue);
          return;
        }
      } catch (_) {}
    }

    // If native detection is not available or failed on image, show guidance
    setCameraError('Could not decode QR code from this image. Please paste your transfer code manually.');
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Scan QR Code">
      <div className="preview-modal qr-scanner-modal">
        <div className="preview-header">
          <h3><QrCode size={18} /> Scan Transfer QR Code</h3>
          <button className="preview-close" onClick={onClose} aria-label="Close scanner">
            <X size={18} />
          </button>
        </div>

        <div className="qr-scanner-body">
          {cameraError ? (
            <div className="qr-scanner-fallback">
              <AlertTriangle size={32} className="qr-scanner-warning-icon" />
              <p className="qr-scanner-fallback-text">{cameraError}</p>
              <button
                className="btn btn-primary btn-md"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={15} /> Upload QR Screenshot
              </button>
            </div>
          ) : (
            <div className="qr-scanner-viewport">
              <video ref={videoRef} className="qr-scanner-video" />
              <div className="qr-scanner-overlay-frame">
                <div className="qr-scanner-reticle"></div>
              </div>
              <p className="qr-scanner-instructions">
                Center the QR code inside the frame to connect automatically.
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>

        <div className="preview-footer qr-scanner-footer">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={14} /> Upload QR Image
          </button>

          {hasCamera && !cameraError && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={toggleFacingMode}
              title="Switch camera"
            >
              <RefreshCw size={14} /> Switch Camera
            </button>
          )}

          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
