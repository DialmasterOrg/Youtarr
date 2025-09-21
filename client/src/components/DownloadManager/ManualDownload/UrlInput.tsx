import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Tooltip,
  LinearProgress,
  Box
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
  ContentPaste as PasteIcon
} from '@mui/icons-material';

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
        await onValidate(pastedText);
        // Always clear input after validation attempt
        setInputValue('');
      }, 500);
    }
  }, [onValidate]);

  const handleAddClick = useCallback(async () => {
    if (inputValue.trim() && !isValidating) {
      await onValidate(inputValue.trim());
      // Always clear input after validation attempt
      setInputValue('');
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
          await onValidate(text);
          // Always clear input after validation attempt
          setInputValue('');
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
    <Box sx={{ position: 'relative' }}>
      {isValidating && (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            zIndex: 1
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
          <InputAdornment position="start">
            <Tooltip title="Paste from clipboard">
              <IconButton
                onClick={handlePasteButtonClick}
                size="small"
                disabled={disabled || isValidating}
              >
                <PasteIcon />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            {isValidating ? (
              <CircularProgress size={20} />
            ) : (
              <>
                {inputValue && (
                  <IconButton
                    onClick={handleClear}
                    size="small"
                    disabled={disabled}
                  >
                    <ClearIcon />
                  </IconButton>
                )}
                <IconButton
                  onClick={handleAddClick}
                  size="small"
                  disabled={!inputValue.trim() || disabled}
                  color="primary"
                >
                  <AddIcon />
                </IconButton>
              </>
            )}
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          '&.Mui-focused fieldset': {
            borderColor: isValidating ? 'warning.main' : 'primary.main',
          },
        },
      }}
      />
    </Box>
  );
};

export default UrlInput;