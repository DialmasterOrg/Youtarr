import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  Typography,
  Collapse,
  IconButton,
} from '../../ui';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Upload as UploadFileIcon,
} from '../../../lib/icons';
import { VideoInfo } from './types';
import { parseYoutubeUrls, BulkParseResult } from './urlParser';

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (videos: VideoInfo[]) => void;
  existingVideoIds: Set<string>;
}

const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
  open,
  onClose,
  onImport,
  existingVideoIds,
}) => {
  const [textValue, setTextValue] = useState('');
  const [parseResult, setParseResult] = useState<BulkParseResult | null>(null);
  const [showInvalid, setShowInvalid] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doParse = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setParseResult(null);
        return;
      }
      const result = parseYoutubeUrls(text, existingVideoIds);
      setParseResult(result);
    },
    [existingVideoIds]
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setTextValue(value);
      setFileError(null);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => doParse(value), 300);
    },
    [doParse]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.txt')) {
        setFileError('Please select a .txt file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        if (typeof content === 'string') {
          setTextValue(content);
          setFileError(null);
          doParse(content);
        }
      };
      reader.onerror = () => {
        setFileError('Failed to read file.');
      };
      reader.readAsText(file);

      // Reset file input so the same file can be re-selected
      e.target.value = '';
    },
    [doParse]
  );

  const handleImport = useCallback(() => {
    if (!parseResult || parseResult.valid.length === 0) return;

    const videos: VideoInfo[] = parseResult.valid.map((parsed) => ({
      youtubeId: parsed.youtubeId,
      url: parsed.url,
      channelName: '',
      videoTitle: '',
      duration: 0,
      publishedAt: 0,
      isAlreadyDownloaded: false,
      isMembersOnly: false,
      isBulkImport: true,
    }));

    onImport(videos);
  }, [parseResult, onImport]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTextValue('');
      setParseResult(null);
      setShowInvalid(false);
      setFileError(null);
    }
  }, [open]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const validCount = parseResult?.valid.length ?? 0;
  const dupeCount = parseResult?.duplicates.length ?? 0;
  const invalidCount = parseResult?.invalid.length ?? 0;
  const playlistCount = parseResult?.playlistLines.length ?? 0;
  const hasResults = parseResult !== null && (validCount > 0 || dupeCount > 0 || invalidCount > 0 || playlistCount > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid="bulk-import-dialog"
    >
      <DialogTitle className="flex items-center justify-between gap-2" onClose={onClose}>
        Bulk Import URLs
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" className="mb-4">
          Paste YouTube video URLs, one per line:
        </Typography>

        <TextField
          multiline
          fullWidth
          rows={10}
          value={textValue}
          onChange={handleTextChange}
          placeholder={
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/jNQXAC9IVRw\nhttps://www.youtube.com/shorts/9bZkp7q19f0'
          }
          variant="outlined"
          inputProps={{ 'data-testid': 'bulk-import-textarea' }}
        />

        <div className="my-4 flex items-center gap-3 text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <Typography variant="caption" color="text.secondary">or</Typography>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Box className="flex items-center gap-2">
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon size={16} />}
            onClick={() => fileInputRef.current?.click()}
            size="small"
          >
            Upload .txt file
          </Button>
          <input
            type="file"
            accept=".txt"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            data-testid="bulk-import-file-input"
          />
          {fileError && (
            <Typography variant="caption" color="error">
              {fileError}
            </Typography>
          )}
        </Box>

        {hasResults && (
          <Box className="mt-4 flex flex-col gap-2">
            {validCount > 0 && (
              <Alert severity="success" variant="outlined">
                {validCount} valid URL{validCount !== 1 ? 's' : ''} found
              </Alert>
            )}

            {dupeCount > 0 && (
              <Alert severity="warning" variant="outlined">
                {dupeCount} duplicate{dupeCount !== 1 ? 's' : ''} skipped
              </Alert>
            )}

            {playlistCount > 0 && (
              <Alert severity="info" variant="outlined">
                {playlistCount} playlist URL{playlistCount !== 1 ? 's' : ''} skipped
                — paste individual video URLs instead
              </Alert>
            )}

            {invalidCount > 0 && (
              <Alert
                severity="error"
                variant="outlined"
                action={
                  <IconButton
                    size="small"
                    onClick={() => setShowInvalid(!showInvalid)}
                    aria-label={showInvalid ? 'hide invalid lines' : 'show invalid lines'}
                  >
                    {showInvalid ? <ExpandLessIcon size={16} /> : <ExpandMoreIcon size={16} />}
                  </IconButton>
                }
              >
                {invalidCount} invalid line{invalidCount !== 1 ? 's' : ''} skipped
              </Alert>
            )}

            <Collapse in={showInvalid}>
              <Box
                className="max-h-[120px] overflow-y-auto rounded-[var(--radius-ui)] bg-muted p-2"
              >
                {parseResult?.invalid.map((line, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    display="block"
                    className="break-all"
                  >
                    {line}
                  </Typography>
                ))}
              </Box>
            </Collapse>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" className="mt-4 block">
          Previously downloaded videos will be skipped unless you enable re-download in the settings dialog.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={validCount === 0}
          data-testid="bulk-import-confirm"
        >
          Add {validCount > 0 ? validCount : ''} to Queue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkImportDialog;
