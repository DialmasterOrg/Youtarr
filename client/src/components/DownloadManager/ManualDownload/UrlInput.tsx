import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TextField,
  CircularProgress,
  Tooltip,
  LinearProgress,
} from '../../ui';
import { Add as AddIcon, Clear as ClearIcon } from '../../../lib/icons';
import { ClipboardPaste as PasteIcon } from 'lucide-react';

interface UrlInputProps {
  onValidate: (url: string) => Promise<boolean>;
  isValidating: boolean;
  disabled?: boolean;
}

const UrlInput: React.FC<UrlInputProps> = ({ onValidate, isValidating, disabled = false }) => {
  const [inputValue, setInputValue] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && (pastedText.includes('youtube.com') || pastedText.includes('youtu.be'))) {
      e.preventDefault(); // Prevent default paste behavior to avoid duplication
      setInputValue(pastedText);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const isValid = await onValidate(pastedText);
        if (isValid) {
          setInputValue('');
        }
      }, 500);
    }
  }, [onValidate]);

  const handleAddClick = useCallback(async () => {
    if (inputValue.trim() && !isValidating) {
      const isValid = await onValidate(inputValue.trim());
      if (isValid) {
        setInputValue('');
      }
    }
  }, [inputValue, isValidating, onValidate]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating && inputValue.trim()) {
      handleAddClick();
    }
  }, [handleAddClick, isValidating, inputValue]);

  const handleClear = useCallback(() => {
    setInputValue('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  const handlePasteButtonClick = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputValue(text);

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
          const isValid = await onValidate(text);
          if (isValid) {
            setInputValue('');
          }
        }, 500);
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  }, [onValidate]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {isValidating && (
        <LinearProgress
          style={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            zIndex: 1,
          }}
        />
      )}
      <TextField
      fullWidth
      variant="outlined"
      placeholder="Paste YouTube video URL here..."
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onPaste={handlePaste}
      onKeyPress={handleKeyPress}
      disabled={disabled || isValidating}
      InputProps={{
        startAdornment: (
          <Tooltip title="Paste from clipboard">
            <button
              type="button"
              onClick={handlePasteButtonClick}
              aria-label="Paste from clipboard"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 4, opacity: (disabled || isValidating) ? 0.5 : 1 }}
              disabled={disabled || isValidating}
            >
              <PasteIcon size={18} data-testid="ContentPasteIcon" />
            </button>
          </Tooltip>
        ),
        endAdornment: (
          <>
            {isValidating ? (
              <CircularProgress size={20} />
            ) : (
              <>
                {inputValue && (
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 4, opacity: disabled ? 0.5 : 1 }}
                    disabled={disabled}
                  >
                    <ClearIcon size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddClick}
                  aria-label="Add"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 4, color: 'var(--primary)', opacity: (!inputValue.trim() || disabled) ? 0.5 : 1 }}
                  disabled={!inputValue.trim() || disabled}
                >
                  <AddIcon size={18} />
                </button>
              </>
            )}
          </>
        ),
      }}
      />
    </div>
  );
};

export default UrlInput;