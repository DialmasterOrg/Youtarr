import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Typography,
} from '../../../ui';
import { Copy as ContentCopyIcon } from 'lucide-react';
import { locationUtils } from '../../../../utils/location';
import { ApiKeyCreatedResponse, ApiKeyRole } from './useApiKeys';

export const generateBookmarklet = (apiKey: string) => {
  const serverUrl = locationUtils.getOrigin();
  return `javascript:(function(){var k='${apiKey}';var s='${serverUrl}';var u=location.href;if(!/youtube\\.com|youtu\\.be/.test(u)){alert('Not YouTube');return;}fetch(s+'/api/videos/download',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':k},body:JSON.stringify({url:u})}).then(function(r){return r.json()}).then(function(d){alert(d.success?'✓ Added: '+(d.video&&d.video.title?d.video.title:'Queued'):'✗ '+d.error)}).catch(function(){alert('✗ Connection failed')})})();`;
};

interface CreatedKeyDialogProps {
  createdKey: ApiKeyCreatedResponse | null;
  role: ApiKeyRole;
  action: 'created' | 'regenerated';
  open: boolean;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

function BookmarkletDetails({ apiKey, onCopy }: { apiKey: string; onCopy: CreatedKeyDialogProps['onCopy'] }) {
  const bookmarklet = generateBookmarklet(apiKey);
  return (
    <>
      <Typography variant="subtitle2" gutterBottom>
        📚 Add to Bookmarks
      </Typography>
      <Typography variant="body2" color="secondary" className="mb-2">
        Drag this button to your bookmarks bar:
      </Typography>
      <Box className="mb-4">
        <a
          href={bookmarklet}
          onClick={(e) => e.preventDefault()}
          draggable="true"
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            borderRadius: 'var(--radius-input)',
            textDecoration: 'none',
            fontWeight: 500,
            cursor: 'grab',
          }}
        >
          📥 Send to Youtarr
        </a>
      </Box>

      <Typography variant="body2" color="secondary" className="mb-2">
        Or copy the bookmarklet code:
      </Typography>
      <Paper className="p-4 mb-6 flex items-center justify-between bg-muted/50 max-h-[100px] overflow-auto">
        <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{bookmarklet}</code>
        <IconButton aria-label="Copy bookmarklet code" onClick={() => onCopy(bookmarklet, 'Bookmarklet')} size="small">
          <ContentCopyIcon size={16} />
        </IconButton>
      </Paper>

      <Typography variant="subtitle2" gutterBottom>
        📱 Mobile / Shortcuts
      </Typography>
      <Typography variant="body2" color="secondary" className="mb-2">
        Use this URL in Apple Shortcuts, Tasker, or other tools:
      </Typography>
      <Paper className="p-4 bg-muted/50">
        <Typography variant="body2" style={{ fontFamily: 'monospace' }} className="mb-2">
          <strong>URL:</strong> {locationUtils.getOrigin()}/api/videos/download
        </Typography>
        <Typography variant="body2" style={{ fontFamily: 'monospace' }} className="mb-2">
          <strong>Method:</strong> POST
        </Typography>
        <Typography variant="body2" style={{ fontFamily: 'monospace' }} className="mb-2">
          <strong>Header:</strong> x-api-key: {apiKey.substring(0, 8)}...
        </Typography>
        <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
          <strong>Body:</strong> {`{ "url": "<youtube-url>" }`}
        </Typography>
      </Paper>
    </>
  );
}

export default function CreatedKeyDialog({ createdKey, role, action, open, onClose, onCopy }: CreatedKeyDialogProps) {
  const key = createdKey?.key || '';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>✓ API Key {action === 'regenerated' ? 'Regenerated' : 'Created'}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" className="mb-6">
          Save this key now - it will not be shown again!
        </Alert>

        <Typography variant="subtitle2" gutterBottom>
          Your API Key
        </Typography>
        <Paper className="p-4 mb-6 flex items-center justify-between bg-muted/50 font-mono break-all">
          <code>{key}</code>
          <IconButton aria-label="Copy API key" onClick={() => onCopy(key, 'API key')} size="small">
            <ContentCopyIcon size={16} />
          </IconButton>
        </Paper>

        {role === 'legacy_download' ? (
          key && <BookmarkletDetails apiKey={key} onCopy={onCopy} />
        ) : (
          <Paper className="p-4 bg-muted/50">
            <Typography variant="body2" className="mb-2">
              Use this key only with <strong>{locationUtils.getOrigin()}/external-api/v1</strong>.
            </Typography>
            <Typography variant="body2" color="secondary">
              Only approved channels are available. You can update grants from this key&apos;s edit action.
            </Typography>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
