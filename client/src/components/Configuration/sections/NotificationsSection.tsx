import React, { useState, ChangeEvent } from 'react';
import {
  FormControlLabel,
  Switch,
  TextField,
  Grid,
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Link,
  Checkbox,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '../../ui';
import {
  Trash2 as DeleteIcon,
  Pencil as EditIcon,
  Save as SaveIcon,
  X as CancelIcon,
  Plus as AddIcon,
  Send as SendIcon,
  CheckCircle2 as CheckCircleIcon,
  AlertCircle as ErrorIcon,
} from 'lucide-react';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, SnackbarState } from '../types';
import {
  getDefaultNameForUrl,
  supportsRichFormatting
} from '../../../config/notificationServices';

// Status for individual webhook tests
interface WebhookTestStatus {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

interface AppriseUrlEntry {
  url: string;
  name: string;
  richFormatting?: boolean;
}

interface NotificationsSectionProps {
  token: string | null;
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  setSnackbar: (snackbar: SnackbarState) => void;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  token,
  config,
  onConfigChange,
  onMobileTooltipClick,
  setSnackbar,
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newRichFormatting, setNewRichFormatting] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingUrl, setEditingUrl] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingRichFormatting, setEditingRichFormatting] = useState(true);
  // Track test status for each webhook by index
  const [webhookTestStatus, setWebhookTestStatus] = useState<Record<number, WebhookTestStatus>>({});
  // Delete confirmation modal
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Normalize appriseUrls to always be an array of objects
  const normalizeAppriseUrls = (urls: any): AppriseUrlEntry[] => {
    if (!urls || !Array.isArray(urls)) return [];
    return urls.map((item: any) => {
      if (typeof item === 'string') {
        return { url: item, name: getDefaultNameForUrl(item), richFormatting: true };
      }
      return {
        url: item.url || '',
        name: item.name || getDefaultNameForUrl(item.url || ''),
        richFormatting: item.richFormatting !== false // Default to true
      };
    });
  };

  const appriseUrls = normalizeAppriseUrls(config.appriseUrls);

  const handleAddUrl = () => {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) {
      setSnackbar({
        open: true,
        message: 'Please enter a notification URL',
        severity: 'warning'
      });
      return;
    }

    if (appriseUrls.some(entry => entry.url === trimmedUrl)) {
      setSnackbar({
        open: true,
        message: 'This URL is already added',
        severity: 'warning'
      });
      return;
    }

    const name = newName.trim() || getDefaultNameForUrl(trimmedUrl);
    const newEntry: AppriseUrlEntry = { 
      url: trimmedUrl, 
      name,
      richFormatting: supportsRichFormatting(trimmedUrl) ? newRichFormatting : false
    };
    onConfigChange({ appriseUrls: [...appriseUrls, newEntry] as any });
    setNewUrl('');
    setNewName('');
    setNewRichFormatting(true);
  };

  const handleDeleteClick = (index: number) => {
    setDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteIndex(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex === null) return;
    
    const updatedUrls = appriseUrls.filter((_, i) => i !== deleteIndex);
    onConfigChange({ appriseUrls: updatedUrls as any });
    if (editingIndex === deleteIndex) {
      setEditingIndex(null);
      setEditingUrl('');
      setEditingName('');
      setEditingRichFormatting(true);
    }
    // Clean up test status for removed webhook
    setWebhookTestStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[deleteIndex];
      // Re-index remaining statuses
      const reindexed: Record<number, WebhookTestStatus> = {};
      Object.entries(newStatus).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > deleteIndex) {
          reindexed[oldIndex - 1] = value;
        } else {
          reindexed[oldIndex] = value;
        }
      });
      return reindexed;
    });
    
    setDeleteDialogOpen(false);
    setDeleteIndex(null);
  };

  const handleTestWebhook = async (index: number, entry: AppriseUrlEntry) => {
    // Set testing status
    setWebhookTestStatus(prev => ({
      ...prev,
      [index]: { status: 'testing' }
    }));

    try {
      const response = await fetch('/api/notifications/test-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token || '',
        },
        body: JSON.stringify({
          url: entry.url,
          name: entry.name,
          richFormatting: entry.richFormatting
        })
      });

      if (response.ok) {
        setWebhookTestStatus(prev => ({
          ...prev,
          [index]: { status: 'success', message: 'Sent successfully!' }
        }));
        // Clear success status after 5 seconds
        setTimeout(() => {
          setWebhookTestStatus(prev => ({
            ...prev,
            [index]: { status: 'idle' }
          }));
        }, 5000);
      } else {
        const error = await response.json();
        setWebhookTestStatus(prev => ({
          ...prev,
          [index]: { status: 'error', message: error.message || 'Failed to send' }
        }));
      }
    } catch (error) {
      setWebhookTestStatus(prev => ({
        ...prev,
        [index]: { status: 'error', message: 'Network error - check console' }
      }));
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingUrl(appriseUrls[index].url);
    setEditingName(appriseUrls[index].name);
    setEditingRichFormatting(appriseUrls[index].richFormatting !== false);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingUrl('');
    setEditingName('');
    setEditingRichFormatting(true);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const trimmedUrl = editingUrl.trim();
    if (!trimmedUrl) {
      setSnackbar({
        open: true,
        message: 'URL cannot be empty',
        severity: 'warning'
      });
      return;
    }

    const otherUrls = appriseUrls.filter((_, i) => i !== editingIndex);
    if (otherUrls.some(entry => entry.url === trimmedUrl)) {
      setSnackbar({
        open: true,
        message: 'This URL is already added',
        severity: 'warning'
      });
      return;
    }

    const name = editingName.trim() || getDefaultNameForUrl(trimmedUrl);
    const updatedUrls = [...appriseUrls];
    updatedUrls[editingIndex] = { 
      url: trimmedUrl, 
      name,
      richFormatting: supportsRichFormatting(trimmedUrl) ? editingRichFormatting : false
    };
    onConfigChange({ appriseUrls: updatedUrls as any });
    setEditingIndex(null);
    setEditingUrl('');
    setEditingName('');
    setEditingRichFormatting(true);
  };

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUrl();
    }
  };    

  const formatUrlForSubtitle = (url: string): string => {
    if (url.length > 50) {
      return `${url.substring(0, 25)}...${url.slice(-20)}`;
    }
    return url;
  };

  return (
    <ConfigurationAccordion
      title="Notifications"
      statusBanner={{
        enabled: config.notificationsEnabled,
        label: 'Enable Notifications',
        onToggle: (enabled) => onConfigChange({ notificationsEnabled: enabled }),
        onText: 'Enabled',
        offText: 'Disabled',
        toggleTestId: 'notifications-enabled-switch',
      }}
      defaultExpanded={false}
    >
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="body2" color="secondary" style={{ marginTop: '-4px' }}>
            Powered by{' '}
            <Link
              href="https://github.com/caronc/apprise"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apprise
            </Link>
            {' '}— supports 100+ services including Discord, Telegram, Slack, and email.
            <InfoTooltip
              text="Receive notifications when new videos are downloaded successfully."
              onMobileClick={onMobileTooltipClick}
            />
          </Typography>
        </Grid>

        {config.notificationsEnabled && (
          <>
            {/* Configured webhooks - show first if any exist */}
            {appriseUrls.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" className="mb-2 flex items-center gap-2">
                  Your Notification Services
                  <Typography component="span" variant="caption" color="secondary">
                    ({appriseUrls.length} configured)
                  </Typography>
                </Typography>
                {appriseUrls.map((entry, index) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    className="p-3 mb-2 border-2 border-primary border-l-4 hover:bg-muted/50"
                  >
                    {editingIndex === index ? (
                      // Edit mode
                      <Box>
                        <Box className="flex gap-2 mb-2">
                          <TextField
                            fullWidth
                            size="small"
                            label="Name"
                            value={editingName}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
                            onKeyDown={handleEditKeyPress}
                            placeholder="e.g., Discord - Gaming Server"
                          />
                        </Box>
                        <Box className="flex gap-2 items-center mb-2">
                          <TextField
                            fullWidth
                            size="small"
                            label="URL"
                            value={editingUrl}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingUrl(e.target.value)}
                            onKeyDown={handleEditKeyPress}
                            autoFocus
                          />
                        </Box>
                        {supportsRichFormatting(editingUrl) && (
                          <Box className="flex items-center mb-2">
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={editingRichFormatting}
                                  onChange={(e) => setEditingRichFormatting(e.target.checked)}
                                  size="small"
                                />
                              }
                              label={
                                <Typography variant="body2">
                                  ✨ Rich formatting (embeds, colors, styling)
                                </Typography>
                              }
                            />
                          </Box>
                        )}
                        <Box className="flex gap-1 justify-end">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleSaveEdit}
                            startIcon={<SaveIcon size={14} />}
                          >
                            Save
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleCancelEdit}
                            startIcon={<CancelIcon size={14} />}
                          >
                            Cancel
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      // View mode
                      <Box>
                        <Box className="flex items-center justify-between">
                          <Box className="flex-1 min-w-0 mr-2">
                            <Box className="flex items-center gap-1.5">
                              <Typography variant="body2" className="font-medium">
                                {entry.name}
                              </Typography>
                              {supportsRichFormatting(entry.url) && (
                                <Typography variant="caption" style={{ 
                                  color: entry.richFormatting !== false ? 'var(--success)' : 'var(--muted-foreground)',
                                  fontSize: '0.7rem'
                                }}>
                                  {entry.richFormatting !== false ? '✨' : '📝'}
                                </Typography>
                              )}
                            </Box>
                            <Typography
                              variant="caption"
                              color="secondary"
                              className="font-mono block overflow-hidden text-ellipsis whitespace-nowrap"
                              title={entry.url}
                            >
                              {formatUrlForSubtitle(entry.url)}
                            </Typography>
                          </Box>
                          <Box className="flex gap-1 items-center">
                            <Tooltip title="Send test notification">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleTestWebhook(index, entry)}
                                  disabled={webhookTestStatus[index]?.status === 'testing'}
                                  color={
                                    webhookTestStatus[index]?.status === 'success' ? 'success' :
                                    webhookTestStatus[index]?.status === 'error' ? 'error' : 'default'
                                  }
                                  aria-label="Test notification"
                                >
                                  {webhookTestStatus[index]?.status === 'testing' ? (
                                    <CircularProgress size={18} />
                                  ) : webhookTestStatus[index]?.status === 'success' ? (
                                    <CheckCircleIcon fontSize="small" />
                                  ) : webhookTestStatus[index]?.status === 'error' ? (
                                    <ErrorIcon fontSize="small" />
                                  ) : (
                                    <SendIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleStartEdit(index)}
                                color="primary"
                                aria-label="Edit notification URL"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(index)}
                                color="error"
                                aria-label="Remove notification URL"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                        {/* Test status message */}
                        {(webhookTestStatus[index]?.status === 'success' || 
                          webhookTestStatus[index]?.status === 'error' ||
                          webhookTestStatus[index]?.status === 'testing') && (
                          <Box className="mt-1">
                            {webhookTestStatus[index]?.status === 'success' && (
                              <Typography variant="caption" color="success" className="font-medium">
                                ✓ {webhookTestStatus[index].message}
                              </Typography>
                            )}
                            {webhookTestStatus[index]?.status === 'error' && (
                              <Typography variant="caption" color="error" className="font-medium">
                                ✗ {webhookTestStatus[index].message}
                              </Typography>
                            )}
                            {webhookTestStatus[index]?.status === 'testing' && (
                              <Typography variant="caption" color="secondary">
                                Sending test...
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Grid>
            )}

            {/* Add new service */}
            <Grid item xs={12}>
              <Paper variant="outlined" className="p-4 bg-muted/30">
                <Typography variant="subtitle2" className="mb-3">
                  {appriseUrls.length === 0 ? 'Add a Notification Service' : 'Add Another Service'}
                </Typography>
                <Box className="flex flex-col gap-3">
                  <TextField
                    fullWidth
                    label="Name (optional)"
                    value={newName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                    placeholder="e.g., Discord - Work Server"
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label="Notification URL"
                    value={newUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewUrl(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g., discord://webhook_id/webhook_token"
                    size="small"
                  />
                  {supportsRichFormatting(newUrl) && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={newRichFormatting}
                          onChange={(e) => setNewRichFormatting(e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2">
                          ✨ Enable rich formatting (embeds, colors, styling)
                        </Typography>
                      }
                      className="ml-0"
                    />
                  )}
                  <Button
                    variant="contained"
                    onClick={handleAddUrl}
                    startIcon={<AddIcon size={16} />}
                    className="self-start"
                  >
                    Add Service
                  </Button>
                </Box>
              </Paper>
            </Grid>

            {/* URL formats reference */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" className="mb-2">
                ✨ Feature Rich Supported Formats
              </Typography>
              <Box className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Discord', url: 'discord://webhook_id/token' },
                  { name: 'Telegram', url: 'tgram://bot_token/chat_id' },
                  { name: 'Slack', url: 'slack://token_a/token_b/token_c' },
                  { name: 'Email', url: 'mailto://user:pass@gmail.com' },
                ].map((service) => (
                  <Box 
                    key={service.name}
                    className="px-3 py-2 rounded bg-muted/50 border border-border"
                  >
                    <Typography variant="body2" className="font-medium mb-0.5">
                      {service.name}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      className="font-mono block overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ color: 'var(--info)', fontSize: '0.7rem' }}
                    >
                      {service.url}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="secondary" className="block mt-2">
                Other services receive plain text.{' '}
                <Link
                  href="https://github.com/caronc/apprise/wiki#notification-services"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View all 100+ services
                </Link>
              </Typography>
            </Grid>
          </>
        )}
      </Grid>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Remove Notification Service?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to remove{' '}
            <strong>{deleteIndex !== null ? appriseUrls[deleteIndex]?.name : ''}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </ConfigurationAccordion>
  );
};
