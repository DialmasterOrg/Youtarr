import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Chip,
  Skeleton,
  Snackbar,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningIcon from '@mui/icons-material/Warning';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';

interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  usage_count: number;
}

interface ApiKeyCreatedResponse {
  success: boolean;
  message: string;
  id: number;
  name: string;
  key: string;
  prefix: string;
}

interface ApiKeysSectionProps {
  token: string | null;
  apiKeyRateLimit: number;
  onRateLimitChange: (value: number) => void;
}

const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({ token, apiKeyRateLimit, onRateLimitChange }) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createdKeyDialogOpen, setCreatedKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; keyId: number | null; keyName: string }>({
    open: false,
    keyId: null,
    keyName: '',
  });
  const [isHttpWarning] = useState(
    window.location.protocol !== 'https:' && window.location.hostname !== 'localhost'
  );

  const fetchApiKeys = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/keys', {
        headers: { 'x-access-token': token },
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to fetch API keys');
      }
    } catch (err) {
      setError('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    if (!token || !newKeyName.trim()) return;

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token,
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCreatedKey(data);
        setCreateDialogOpen(false);
        setCreatedKeyDialogOpen(true);
        setNewKeyName('');
        fetchApiKeys();
      } else {
        setError(data.error || 'Failed to create API key');
      }
    } catch (err) {
      setError('Failed to create API key');
    }
  };

  const handleDeleteKey = async () => {
    if (!token || !deleteConfirmDialog.keyId) return;

    try {
      const response = await fetch(`/api/keys/${deleteConfirmDialog.keyId}`, {
        method: 'DELETE',
        headers: { 'x-access-token': token },
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'API key deleted' });
        fetchApiKeys();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete API key');
      }
    } catch (err) {
      setError('Failed to delete API key');
    } finally {
      setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' });
    }
  };

  const openDeleteConfirmDialog = (id: number, name: string) => {
    setDeleteConfirmDialog({ open: true, keyId: id, keyName: name });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: `${label} copied to clipboard` });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const generateBookmarklet = (apiKey: string) => {
    const serverUrl = window.location.origin;
    const code = `javascript:(function(){var k='${apiKey}';var s='${serverUrl}';var u=location.href;if(!/youtube\\.com|youtu\\.be/.test(u)){alert('Not YouTube');return;}fetch(s+'/api/videos/download',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':k},body:JSON.stringify({url:u})}).then(function(r){return r.json()}).then(function(d){alert(d.success?'✓ Added: '+(d.video&&d.video.title?d.video.title:'Queued'):'✗ '+d.error)}).catch(function(){alert('✗ Connection failed')})})();`;
    return code;
  };

  if (loading) {
    return (
      <ConfigurationAccordion title="API Keys & External Access">
        <Skeleton variant="rectangular" height={200} />
      </ConfigurationAccordion>
    );
  }

  return (
    <ConfigurationAccordion title="API Keys & External Access">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        API keys allow external tools like bookmarklets and mobile shortcuts to send individual videos to Youtarr.
        <strong> Note:</strong> API keys currently support single video downloads only—playlists and channels require the web UI.
      </Typography>

      {/* Rate Limit Setting */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TextField
          type="number"
          label="Rate Limit (requests/min)"
          value={apiKeyRateLimit}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 100) {
              onRateLimitChange(val);
            }
          }}
          inputProps={{ min: 1, max: 100 }}
          size="small"
          sx={{ width: 200 }}
        />
        <InfoTooltip text="Maximum download requests per minute per API key. Helps prevent abuse." />
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1">Manage API Keys</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          size="small"
        >
          Create Key
        </Button>
      </Box>

      {isHttpWarning && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          Creating API keys over HTTP is insecure. Use HTTPS in production.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {apiKeys.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No API keys created yet. Create one to enable external integrations.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell align="center">Uses</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${key.key_prefix}...`}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatDate(key.created_at)}</TableCell>
                  <TableCell>{formatDate(key.last_used_at)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={key.usage_count}
                      size="small"
                      color={key.usage_count > 0 ? 'primary' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => openDeleteConfirmDialog(key.id, key.name)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Key Name"
            placeholder="e.g., iPhone Shortcut, Bookmarklet"
            fullWidth
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            inputProps={{ maxLength: 100 }}
            helperText="A descriptive name to identify this key"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateKey}
            variant="contained"
            disabled={!newKeyName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Key Created Dialog with Bookmarklet */}
      <Dialog
        open={createdKeyDialogOpen}
        onClose={() => setCreatedKeyDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>✓ API Key Created</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Save this key now - it will not be shown again!
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            Your API Key
          </Typography>
          <Paper
            sx={{
              p: 2,
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'action.hover',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            <code>{createdKey?.key}</code>
            <IconButton
              onClick={() => copyToClipboard(createdKey?.key || '', 'API key')}
              size="small"
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Paper>

          <Typography variant="subtitle2" gutterBottom>
            📚 Add to Bookmarks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Drag this button to your bookmarks bar:
          </Typography>
          <Box sx={{ mb: 2 }}>
            <a
              href={createdKey ? generateBookmarklet(createdKey.key) : '#'}
              onClick={(e) => e.preventDefault()}
              draggable="true"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: 'white',
                borderRadius: '4px',
                textDecoration: 'none',
                fontWeight: 500,
                cursor: 'grab',
              }}
            >
              📥 Send to Youtarr
            </a>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Or copy the bookmarklet code:
          </Typography>
          <Paper
            sx={{
              p: 2,
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'action.hover',
              maxHeight: 100,
              overflow: 'auto',
            }}
          >
            <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {createdKey ? generateBookmarklet(createdKey.key) : ''}
            </code>
            <IconButton
              onClick={() =>
                copyToClipboard(
                  createdKey ? generateBookmarklet(createdKey.key) : '',
                  'Bookmarklet'
                )
              }
              size="small"
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Paper>

          <Typography variant="subtitle2" gutterBottom>
            📱 Mobile / Shortcuts
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Use this URL in Apple Shortcuts, Tasker, or other tools:
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
              <strong>URL:</strong> {window.location.origin}/api/videos/download
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
              <strong>Method:</strong> POST
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
              <strong>Header:</strong> x-api-key: {createdKey?.key?.substring(0, 8)}...
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              <strong>Body:</strong> {`{ "url": "<youtube-url>" }`}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatedKeyDialogOpen(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' })}
      >
        <DialogTitle>Delete API Key?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the API key <strong>&quot;{deleteConfirmDialog.keyName}&quot;</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. Any integrations using this key will stop working.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteKey} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </ConfigurationAccordion>
  );
};

export default ApiKeysSection;

