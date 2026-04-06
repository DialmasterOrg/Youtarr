import React, { useState, useRef } from 'react';
import {
  Box, Button, Tab, Tabs, Typography, Alert, CircularProgress,
} from '@mui/material';
import { UploadFile as UploadFileIcon } from '@mui/icons-material';
import { ImportSource } from '../../../types/subscriptionImport';

interface SourcePickerProps {
  loading: boolean;
  error: string | null;
  onSubmit: (source: ImportSource, file: File) => void;
}

const TAB_INDEX_TO_SOURCE: ImportSource[] = ['takeout', 'cookies'];

const TAKEOUT_INSTRUCTIONS = 'Upload your Google Takeout CSV file (subscriptions.csv). '
  + 'You can export this from Google Takeout by selecting YouTube data and choosing the CSV format.';

const COOKIES_INSTRUCTIONS = 'Upload a Netscape-format cookies.txt file exported from your browser. '
  + 'This will be used to fetch your current YouTube subscriptions via yt-dlp.';

const SourcePicker: React.FC<SourcePickerProps> = ({ loading, error, onSubmit }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const source = TAB_INDEX_TO_SOURCE[tabIndex];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onSubmit(source, selectedFile);
    }
  };

  const acceptType = source === 'takeout' ? '.csv' : '.txt';

  return (
    <Box>
      <Tabs value={tabIndex} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Google Takeout" />
        <Tab label="Cookies" />
      </Tabs>

      <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
        {source === 'takeout' ? TAKEOUT_INSTRUCTIONS : COOKIES_INSTRUCTIONS}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadFileIcon />}
          disabled={loading}
        >
          Choose File
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptType}
            hidden
            onChange={handleFileChange}
            data-testid="file-input"
          />
        </Button>
        {selectedFile && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {selectedFile.name}
          </Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={!selectedFile || loading}
        startIcon={loading ? <CircularProgress size={20} /> : undefined}
      >
        {loading ? 'Uploading...' : 'Upload & Preview'}
      </Button>
    </Box>
  );
};

export default SourcePicker;
