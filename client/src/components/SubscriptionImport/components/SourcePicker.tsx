import React, { useState, useRef } from 'react';
import {
  Box, Button, Tab, Tabs, Typography, Alert, CircularProgress, Link, Collapse,
} from '@mui/material';
import { UploadFile as UploadFileIcon, ExpandMore, ExpandLess } from '@mui/icons-material';
import { ImportSource } from '../../../types/subscriptionImport';

interface SourcePickerProps {
  loading: boolean;
  error: string | null;
  errorDetails?: string;
  onSubmit: (source: ImportSource, file: File) => void;
}

// Cookies tab is default (index 0), CSV tab is index 1
const TAB_INDEX_TO_SOURCE: ImportSource[] = ['cookies', 'takeout'];

const COOKIES_EXTENSION_URL = 'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc';

const SourcePicker: React.FC<SourcePickerProps> = ({ loading, error, errorDetails, onSubmit }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showDetails, setShowDetails] = useState(false);
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
        <Tab label="Import Using Cookies" />
        <Tab label="Import Using CSV" />
      </Tabs>

      {source === 'cookies' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            Export your cookies from a browser that is logged in with the YouTube account
            you want to import subscribed channels from. You can use the{' '}
            <Link href={COOKIES_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
              Get cookies.txt LOCALLY
            </Link>{' '}
            Chrome extension to export your cookies in the correct Netscape format.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            Upload the exported cookies.txt file below and we will fetch your subscribed
            channels directly from YouTube.
          </Typography>
          <Alert severity="info" sx={{ mb: 1 }}>
            Your cookies will only be used once to fetch your subscribed channels and will
            not be saved. They are deleted immediately after the fetch completes.
          </Alert>
        </Box>
      )}

      {source === 'takeout' && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Google Takeout exports can take 24-72 hours to receive from Google.
            If you need your subscriptions sooner, try the cookies method instead.
          </Alert>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
            How to export your subscriptions from Google Takeout:
          </Typography>
          <Box component="ol" sx={{ pl: 2.5, mb: 2, '& li': { mb: 0.5 } }}>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Go to{' '}
              <Link href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer">
                takeout.google.com
              </Link>{' '}
              and sign in with your Google account.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Click <strong>Deselect all</strong> to clear all pre-selected data products.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Scroll down and find <strong>YouTube and YouTube Music</strong> and check its checkbox.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Click the <strong>All YouTube data included</strong> button that appears.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              In the panel that opens, click <strong>Deselect all</strong>, then check <strong>only</strong> the{' '}
              <strong>subscriptions</strong> checkbox.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Click <strong>OK</strong>, then <strong>Next step</strong>.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Choose <strong>Export once</strong>, keep the file type as ZIP, and click{' '}
              <strong>Create export</strong>.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Wait for the email from Google (can take 24-72 hours), then download and extract the ZIP.
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: 'text.secondary' }}>
              Find the file at:{' '}
              <code>Takeout/YouTube and YouTube Music/subscriptions/subscriptions.csv</code>
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Upload that <strong>subscriptions.csv</strong> file below.
          </Typography>
        </Box>
      )}

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
          <Typography variant="body2">{error}</Typography>
          {errorDetails && (
            <>
              <Button
                size="small"
                onClick={() => setShowDetails((prev) => !prev)}
                endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
                sx={{ mt: 1, p: 0, minWidth: 'auto', textTransform: 'none' }}
              >
                {showDetails ? 'Hide technical details' : 'Show technical details'}
              </Button>
              <Collapse in={showDetails}>
                <Box
                  component="pre"
                  sx={{
                    mt: 1,
                    p: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {errorDetails}
                </Box>
              </Collapse>
            </>
          )}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={!selectedFile || loading}
        startIcon={loading ? <CircularProgress size={20} /> : undefined}
      >
        {loading ? 'Processing...' : 'Upload & Preview'}
      </Button>

      {loading && (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          {source === 'cookies'
            ? 'Fetching your subscriptions from YouTube and loading channel thumbnails. This may take up to a minute...'
            : 'Parsing your subscriptions and loading channel thumbnails. This may take up to a minute...'}
        </Typography>
      )}
    </Box>
  );
};

export default SourcePicker;
