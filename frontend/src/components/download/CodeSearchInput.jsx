import React from 'react';
import { Copy, Key, Loader2 } from 'lucide-react';

/**
 * CodeSearchInput Component
 * Primary Responsibility: Handle user input for transfer codes, clipboard paste action, and connect submit trigger.
 */
export function CodeSearchInput({
  codeInput,
  onChangeCodeInput,
  onSearchCode,
  onPasteClipboard,
  isLoading,
  isDecrypting
}) {
  return (
    <div className="download-input" role="search">
      <input
        type="text"
        placeholder="Paste transfer code (e.g. FS-A1B2C3D4E5F60708-9F8A73C21D2E3F40)"
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
        aria-label="Transfer Code"
      />
      <div className="download-input-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={onPasteClipboard}
          title="Paste from clipboard"
          disabled={isLoading || isDecrypting}
        >
          <Copy size={14} /> Paste
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSearchCode()}
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
  );
}
