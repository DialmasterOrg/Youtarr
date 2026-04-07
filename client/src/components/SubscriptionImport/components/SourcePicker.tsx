import React, { useState, useRef } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Collapse,
  Typography,
} from '../../ui';
import { ChevronDown as ExpandMore, ChevronUp as ExpandLess, Upload as UploadFileIcon } from '../../../lib/icons';
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
    <Card variant="outlined">
      <CardContent className="space-y-4">
        <div role="tablist" aria-label="Import source" className="flex w-full border-b border-border">
          <button
            role="tab"
            type="button"
            aria-selected={tabIndex === 0}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tabIndex === 0 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={(event) => handleTabChange(event, 0)}
          >
            Import Using Cookies
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={tabIndex === 1}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tabIndex === 1 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={(event) => handleTabChange(event, 1)}
          >
            Import Using CSV
          </button>
        </div>

        {source === 'cookies' && (
          <div className="space-y-3">
            <Typography variant="body2" color="secondary">
            Export your cookies from a browser that is logged in with the YouTube account
            you want to import subscribed channels from. You can use the{' '}
            <a href={COOKIES_EXTENSION_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Get cookies.txt LOCALLY
            </a>{' '}
            Chrome extension to export your cookies in the correct Netscape format.
            </Typography>
            <Typography variant="body2" color="secondary">
            Upload the exported cookies.txt file below and we will fetch your subscribed
            channels directly from YouTube.
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                Your cookies will only be used once to fetch your subscribed channels and will
                not be saved. They are deleted immediately after the fetch completes.
              </Typography>
            </Alert>
          </div>
        )}

        {source === 'takeout' && (
          <div className="space-y-3">
            <Alert severity="warning">
              <Typography variant="body2">
            Google Takeout exports can take 24-72 hours to receive from Google.
            If you need your subscriptions sooner, try the cookies method instead.
              </Typography>
            </Alert>
            <Typography variant="subtitle2">How to export your subscriptions from Google Takeout:</Typography>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
              Go to{' '}
              <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                takeout.google.com
              </a>{' '}
              and sign in with your Google account.
              </li>
              <li>Click <strong>Deselect all</strong> to clear all pre-selected data products.</li>
              <li>Scroll down and find <strong>YouTube and YouTube Music</strong> and check its checkbox.</li>
              <li>Click the <strong>All YouTube data included</strong> button that appears.</li>
              <li>In the panel that opens, click <strong>Deselect all</strong>, then check <strong>only</strong> the <strong>subscriptions</strong> checkbox.</li>
              <li>Click <strong>OK</strong>, then <strong>Next step</strong>.</li>
              <li>Choose <strong>Export once</strong>, keep the file type as ZIP, and click <strong>Create export</strong>.</li>
              <li>Wait for the email from Google, then download and extract the ZIP.</li>
              <li>Find the file at <code>Takeout/YouTube and YouTube Music/subscriptions/subscriptions.csv</code>.</li>
            </ol>
            <Typography variant="body2" color="secondary">
            Upload that <strong>subscriptions.csv</strong> file below.
            </Typography>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outlined" disabled={loading}>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <UploadFileIcon size={16} />
                Choose File
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptType}
                hidden
                onChange={handleFileChange}
                data-testid="file-input"
              />
            </label>
          </Button>
          {selectedFile && <Typography variant="body2" color="secondary">{selectedFile.name}</Typography>}
        </div>

        {error && (
          <Alert severity="error">
            <div className="space-y-2">
              <Typography variant="body2">{error}</Typography>
              {errorDetails && (
                <>
                  <Button
                    size="small"
                    variant="link"
                    onClick={() => setShowDetails((prev) => !prev)}
                    endIcon={showDetails ? <ExpandLess size={14} /> : <ExpandMore size={14} />}
                  >
                    {showDetails ? 'Hide technical details' : 'Show technical details'}
                  </Button>
                  <Collapse in={showDetails}>
                    <pre className="max-h-52 overflow-auto rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-muted/50 p-3 text-xs whitespace-pre-wrap break-words">
                      {errorDetails}
                    </pre>
                  </Collapse>
                </>
              )}
            </div>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!selectedFile || loading}
          >
            {loading ? 'Processing...' : 'Upload & Preview'}
          </Button>
          {loading && <CircularProgress size={20} />}
        </div>

        {loading && (
          <Typography variant="body2" color="secondary">
          {source === 'cookies'
            ? 'Fetching your subscriptions from YouTube and loading channel thumbnails. This may take up to a minute...'
            : 'Parsing your subscriptions and loading channel thumbnails. This may take up to a minute...'}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default SourcePicker;
