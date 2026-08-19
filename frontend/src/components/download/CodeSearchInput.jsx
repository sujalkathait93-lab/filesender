import React from 'react';
import { Copy, Key, Loader2, QrCode } from 'lucide-react';

/**
 * CodeSearchInput Component
 * Primary Responsibility: Handle user input for 10-digit transfer codes, clipboard paste, camera QR scan trigger, and connect submit.
 */
export function CodeSearchInput({
  codeInput,
  onChangeCodeInput,
  onSearchCode,
  onPasteClipboard,
  onOpenQRScanner,
  isLoading,
  isDecrypting
}) {
  return (
    <div className="download-input" role="search">
      <input
        type="text"
        placeholder="Enter 10-Digit Transfer Code (e.g. FS-48A19-9F7C2 or 48A19-9F7C2)"
        value={codeInput}
        onChange={(e) => onChangeCodeInput(e.target.value.replace(/[^a-zA-Z0-9\-:_/?.#=&]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && onSearchCode()}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck="false"
        data-lpignore="true"
        data-form-type="other"
        maxLength={128}
        disabled={isLoading || isDecrypting}
        aria-label="Enter 10-Digit Transfer Code or URL"
      />
      <div className="download-input-actions">
        {onOpenQRScanner && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenQRScanner}
            title="Scan QR code with camera"
            disabled={isLoading || isDecrypting}
            aria-label="Scan QR code"
          >
            <QrCode size={14} /> Scan QR
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onPasteClipboard}
          title="Paste transfer code from clipboard"
          disabled={isLoading || isDecrypting}
          aria-label="Paste from clipboard"
        >
          <Copy size={14} /> Paste
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onSearchCode()}
          disabled={isLoading || isDecrypting || !codeInput.trim()}
          aria-busy={isLoading}
          aria-label="Connect and receive files"
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
  );
}
