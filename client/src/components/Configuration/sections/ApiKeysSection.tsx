import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
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
  Checkbox,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
} from '../../ui';
import {
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  Copy as ContentCopyIcon,
  AlertTriangle as WarningIcon,
  Pencil as EditIcon,
  RefreshCw as RegenerateIcon,
  Video as VideoIcon,
  Radio as ChannelIcon,
  Clock3 as ClockIcon,
  Zap as AutoApproveIcon,
  Eye as ViewIcon,
  Filter as FilterIcon,
} from 'lucide-react';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';

import { locationUtils } from '../../../utils/location';
import {
  EXTERNAL_RATING_BANDS,
  formatExternalRatingBand,
  getExternalRatingBand,
} from '../../../utils/externalRatingPolicy';
import RatingBadge from '../../shared/RatingBadge';

interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  usage_count: number;
  channel_grant_count?: number;
  role: ApiKeyRole;
  auto_approve_video_requests: boolean;
  auto_approve_channel_requests: boolean;
  auto_approve_delete_requests: boolean;
  allow_video_requests: boolean;
  allow_channel_requests: boolean;
  allow_delete_video_requests: boolean;
  max_rating_level: number;
  allow_unrated: boolean;
  allowed_media_types: MediaType[];
  max_active_jobs?: number;
  hourly_write_limit?: number;
  daily_write_limit?: number;
  revoked_at: string | null;
}

type ApiKeyRole = 'legacy_download' | 'view' | 'request' | 'delete' | 'admin';
type MediaType = 'video' | 'short' | 'livestream';

interface ApiKeyPolicy {
  role: ApiKeyRole;
  allowVideoRequests: boolean;
  allowChannelRequests: boolean;
  allowDeleteVideoRequests: boolean;
  autoApproveVideoRequests: boolean;
  autoApproveChannelRequests: boolean;
  autoApproveDeleteRequests: boolean;
  maxRatingLevel: number;
  allowUnrated: boolean;
  allowedMediaTypes: MediaType[];
  maxActiveJobs: number;
  hourlyWriteLimit: number;
  dailyWriteLimit: number;
}

interface ChannelOption {
  database_id?: number;
  channel_id?: string;
  uploader: string;
  title?: string;
  terminated_at?: string | null;
}

const defaultPolicy: ApiKeyPolicy = {
  role: 'view',
  allowVideoRequests: false,
  allowChannelRequests: false,
  allowDeleteVideoRequests: false,
  autoApproveVideoRequests: false,
  autoApproveChannelRequests: false,
  autoApproveDeleteRequests: false,
  maxRatingLevel: 3,
  allowUnrated: false,
  allowedMediaTypes: ['video'],
  maxActiveJobs: 5,
  hourlyWriteLimit: 30,
  dailyWriteLimit: 200,
};

const legacyRolePermissions = (role: ApiKeyRole) => ({
  allowVideoRequests: ['request', 'delete', 'admin'].includes(role),
  allowChannelRequests: ['request', 'delete', 'admin'].includes(role),
  allowDeleteVideoRequests: ['delete', 'admin'].includes(role),
});

const permissionsFromKey = (key: ApiKey) => {
  const fallback = legacyRolePermissions(key.role);
  return {
    allowVideoRequests: key.allow_video_requests ?? fallback.allowVideoRequests,
    allowChannelRequests: key.allow_channel_requests ?? fallback.allowChannelRequests,
    allowDeleteVideoRequests:
      key.allow_delete_video_requests ?? fallback.allowDeleteVideoRequests,
  };
};

const roleForPolicy = (policy: ApiKeyPolicy): ApiKeyRole => {
  if (policy.role === 'admin') return 'admin';
  if (policy.allowDeleteVideoRequests) return 'delete';
  if (policy.allowVideoRequests || policy.allowChannelRequests) return 'request';
  return 'view';
};

const policyFromKey = (key: ApiKey): ApiKeyPolicy => ({
  role: key.role,
  ...permissionsFromKey(key),
  autoApproveVideoRequests: key.auto_approve_video_requests,
  autoApproveChannelRequests: key.auto_approve_channel_requests,
  autoApproveDeleteRequests: key.auto_approve_delete_requests,
  maxRatingLevel: key.max_rating_level,
  allowUnrated: key.allow_unrated,
  allowedMediaTypes: key.allowed_media_types,
  maxActiveJobs: key.max_active_jobs ?? 5,
  hourlyWriteLimit: key.hourly_write_limit ?? 30,
  dailyWriteLimit: key.daily_write_limit ?? 200,
});

const PolicyEditor: React.FC<{
  policy: ApiKeyPolicy;
  onChange: (policy: ApiKeyPolicy) => void;
}> = ({ policy, onChange }) => {
  const updatePolicy = (changes: Partial<ApiKeyPolicy>) => {
    const next = { ...policy, ...changes };
    onChange({ ...next, role: roleForPolicy(next) });
  };
  const togglePermission = (
    permission: 'allowVideoRequests' | 'allowChannelRequests' | 'allowDeleteVideoRequests',
    autoApprove: 'autoApproveVideoRequests' | 'autoApproveChannelRequests' |
      'autoApproveDeleteRequests',
    enabled: boolean
  ) => updatePolicy({
    [permission]: enabled,
    ...(!enabled ? { [autoApprove]: false } : {}),
  });
  const toggleMedia = (mediaType: MediaType) => {
    const selected = policy.allowedMediaTypes.includes(mediaType);
    if (selected && policy.allowedMediaTypes.length === 1) return;
    updatePolicy({
      allowedMediaTypes: selected
        ? policy.allowedMediaTypes.filter((value) => value !== mediaType)
        : [...policy.allowedMediaTypes, mediaType],
    });
  };
  return (
    <Box className="mt-4 space-y-5">
      <Box className="space-y-1">
        <Typography variant="caption" color="secondary">
          Maximum allowed rating
        </Typography>
        <Select
          fullWidth
          aria-label="Maximum allowed rating"
          inputProps={{ 'aria-label': 'Maximum allowed rating' }}
          value={policy.maxRatingLevel}
          onChange={(event) => updatePolicy({
            maxRatingLevel: Number(event.target.value),
          })}
        >
          {EXTERNAL_RATING_BANDS.map((band) => (
            <MenuItem key={band.level} value={band.level}>
              {formatExternalRatingBand(band.level)}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="secondary">
          Uses the video rating first, then the channel&apos;s manually assigned default.
        </Typography>
      </Box>

      <Box className="space-y-2">
        <Typography variant="subtitle2">Content access</Typography>
        <FormControlLabel
          control={<Switch checked={policy.allowUnrated} onChange={(event) =>
            updatePolicy({ allowUnrated: event.target.checked })
          } />}
          label="Allow unrated or unrecognized ratings"
        />
        <Box className="flex flex-wrap gap-x-5 gap-y-2">
          {(['video', 'short', 'livestream'] as MediaType[]).map((mediaType) => (
            <FormControlLabel
              key={mediaType}
              control={<Switch
                size="small"
                checked={policy.allowedMediaTypes.includes(mediaType)}
                onChange={() => toggleMedia(mediaType)}
              />}
              label={mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
            />
          ))}
        </Box>
      </Box>

      <Box className="space-y-2">
        <div className="flex items-center gap-2">
          <Typography variant="subtitle2">Request permissions</Typography>
          <Tooltip title="Catalog viewing and request-status access are included with every external key.">
            <Chip
              size="small"
              variant="outlined"
              icon={<ViewIcon size={13} />}
              label="View included"
            />
          </Tooltip>
        </div>
        {([
          {
            permission: 'allowVideoRequests' as const,
            autoApprove: 'autoApproveVideoRequests' as const,
            label: 'Request videos',
            description: 'Submit requests to download eligible videos.',
          },
          {
            permission: 'allowChannelRequests' as const,
            autoApprove: 'autoApproveChannelRequests' as const,
            label: 'Request channels',
            description: 'Submit requests to add supported YouTube channels.',
          },
          {
            permission: 'allowDeleteVideoRequests' as const,
            autoApprove: 'autoApproveDeleteRequests' as const,
            label: 'Delete downloaded videos',
            description: 'Submit approval-backed requests to remove downloaded video assets.',
          },
        ]).map((item) => {
          const enabled = policy[item.permission];
          return (
            <Paper key={item.permission} className="border border-border bg-muted/20 p-3 shadow-none">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Typography variant="body2" className="font-medium">{item.label}</Typography>
                  <Typography variant="caption" color="secondary">{item.description}</Typography>
                </div>
                <Switch
                  checked={enabled}
                  onChange={(event) => togglePermission(
                    item.permission,
                    item.autoApprove,
                    event.target.checked
                  )}
                  aria-label={item.label}
                />
              </div>
              {enabled && (
                <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3">
                  <div>
                    <Typography variant="body2">Auto-approve</Typography>
                    <Typography variant="caption" color="secondary">
                      Skip manual review when all current policy checks pass.
                    </Typography>
                  </div>
                  <Switch
                    checked={policy[item.autoApprove]}
                    onChange={(event) => updatePolicy({
                      [item.autoApprove]: event.target.checked,
                    })}
                    aria-label={`Auto-approve ${item.label.toLowerCase()}`}
                  />
                </div>
              )}
            </Paper>
          );
        })}
      </Box>

      <Box className="space-y-2">
        <Typography variant="subtitle2">Workload limits</Typography>
        <Typography variant="caption" color="secondary">
          Durable per-key ceilings. Limits can be reduced below the system defaults.
        </Typography>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            type="number"
            label="Active jobs"
            value={policy.maxActiveJobs}
            inputProps={{ min: 1, max: 5 }}
            onChange={(event) => updatePolicy({
              maxActiveJobs: Number(event.target.value),
            })}
          />
          <TextField
            type="number"
            label="Writes per hour"
            value={policy.hourlyWriteLimit}
            inputProps={{ min: 1, max: 30 }}
            onChange={(event) => updatePolicy({
              hourlyWriteLimit: Number(event.target.value),
            })}
          />
          <TextField
            type="number"
            label="Writes per day"
            value={policy.dailyWriteLimit}
            inputProps={{ min: 1, max: 200 }}
            onChange={(event) => updatePolicy({
              dailyWriteLimit: Number(event.target.value),
            })}
          />
        </div>
      </Box>
    </Box>
  );
};

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
  showRequestsNavLink: boolean;
  onShowRequestsNavLinkChange: (value: boolean) => void;
}

const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({
  token,
  apiKeyRateLimit,
  onRateLimitChange,
  showRequestsNavLink,
  onShowRequestsNavLinkChange,
}) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createKeyType, setCreateKeyType] = useState<'external' | 'legacy'>('external');
  const [createdKeyDialogOpen, setCreatedKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPolicy, setNewKeyPolicy] = useState<ApiKeyPolicy>(defaultPolicy);
  const [newKeyChannelIds, setNewKeyChannelIds] = useState<number[]>([]);
  const [newKeyChannelSearch, setNewKeyChannelSearch] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [createdKeyRole, setCreatedKeyRole] = useState<ApiKeyRole>('legacy_download');
  const [createdKeyAction, setCreatedKeyAction] = useState<'created' | 'regenerated'>('created');
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const [editPolicy, setEditPolicy] = useState<ApiKeyPolicy>(defaultPolicy);
  const [channelOptions, setChannelOptions] = useState<ChannelOption[]>([]);
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [originalChannelIds, setOriginalChannelIds] = useState<number[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [externalKeySearch, setExternalKeySearch] = useState('');
  const [showActiveExternalKeys, setShowActiveExternalKeys] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; keyId: number | null; keyName: string }>({
    open: false,
    keyId: null,
    keyName: '',
  });
  const [regenerateConfirmDialog, setRegenerateConfirmDialog] = useState<{
    open: boolean;
    key: ApiKey | null;
  }>({ open: false, key: null });
  const [regenerating, setRegenerating] = useState(false);
  const [isHttpWarning] = useState(
    locationUtils.getProtocol() !== 'https:' && locationUtils.getHostname() !== 'localhost'
  );

  const setAvailableChannels = (channels: ChannelOption[]) => {
    setChannelOptions(
      channels.filter((channel) =>
        channel.database_id && !channel.terminated_at
      )
    );
  };

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

  const fetchAvailableChannels = async (): Promise<ChannelOption[]> => {
    if (!token) return [];

    const channels: ChannelOption[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await fetch(`/getchannels?page=${page}&pageSize=100&sortOrder=asc`, {
        headers: { 'x-access-token': token },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to load channels');
      channels.push(...(body.channels || []));
      if (page === 1) {
        const reportedTotalPages = Number(body.totalPages);
        totalPages = Number.isInteger(reportedTotalPages) && reportedTotalPages > 0
          ? reportedTotalPages
          : 1;
      }
      page += 1;
    } while (page <= totalPages);

    return channels;
  };

  const loadAvailableChannels = async () => {
    try {
      setAvailableChannels(await fetchAvailableChannels());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    }
  };

  const openCreateDialog = (type: 'external' | 'legacy' = 'external') => {
    setCreateKeyType(type);
    setCreateDialogOpen(true);
    setNewKeyPolicy(defaultPolicy);
    setNewKeyChannelIds([]);
    setNewKeyChannelSearch('');
    setChannelOptions([]);
    if (type === 'external') void loadAvailableChannels();
  };

  const changeNewKeyPolicy = (policy: ApiKeyPolicy) => {
    setNewKeyPolicy(policy);
  };

  const handleCreateKey = async () => {
    if (!token || !newKeyName.trim()) return;

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          ...(createKeyType === 'legacy'
            ? {}
            : { policy: newKeyPolicy, channelIds: newKeyChannelIds }),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCreatedKey(data);
        setCreatedKeyAction('created');
        setCreatedKeyRole(createKeyType === 'legacy' ? 'legacy_download' : newKeyPolicy.role);
        setCreateDialogOpen(false);
        setCreatedKeyDialogOpen(true);
        setNewKeyName('');
        setNewKeyPolicy(defaultPolicy);
        setNewKeyChannelIds([]);
        setNewKeyChannelSearch('');
        fetchApiKeys();
      } else {
        setError(data.error || 'Failed to create API key');
      }
    } catch (err) {
      setError('Failed to create API key');
    }
  };

  const openEditDialog = async (key: ApiKey) => {
    if (!token || key.role === 'legacy_download' || key.revoked_at) return;
    setEditKey(key);
    setEditPolicy(policyFromKey(key));
    setSelectedChannelIds([]);
    setOriginalChannelIds([]);
    setChannelSearch('');
    try {
      const [grantsResponse, channels] = await Promise.all([
        fetch(`/api/keys/${key.id}/channels`, {
          headers: { 'x-access-token': token },
        }),
        fetchAvailableChannels(),
      ]);
      const grants = await grantsResponse.json();
      if (!grantsResponse.ok) {
        throw new Error(grants.error || 'Failed to load external access settings');
      }
      const grantedChannelIds = grants.channelIds || [];
      setSelectedChannelIds(grantedChannelIds);
      setOriginalChannelIds(grantedChannelIds);
      setAvailableChannels(channels);
    } catch (err) {
      setEditKey(null);
      setError(err instanceof Error ? err.message : 'Failed to load external access settings');
    }
  };

  const saveExternalAccess = async () => {
    if (!token || !editKey) return;
    const increasesPrivilege =
      (editPolicy.allowVideoRequests && !permissionsFromKey(editKey).allowVideoRequests) ||
      (editPolicy.allowChannelRequests && !permissionsFromKey(editKey).allowChannelRequests) ||
      (editPolicy.allowDeleteVideoRequests &&
        !permissionsFromKey(editKey).allowDeleteVideoRequests) ||
      (editPolicy.autoApproveVideoRequests && !editKey.auto_approve_video_requests) ||
      (editPolicy.autoApproveChannelRequests && !editKey.auto_approve_channel_requests) ||
      (editPolicy.autoApproveDeleteRequests && !editKey.auto_approve_delete_requests) ||
      editPolicy.maxRatingLevel > editKey.max_rating_level ||
      (editPolicy.allowUnrated && !editKey.allow_unrated) ||
      editPolicy.allowedMediaTypes.some(
        (mediaType) => !editKey.allowed_media_types.includes(mediaType)
      ) ||
      editPolicy.maxActiveJobs > (editKey.max_active_jobs ?? 5) ||
      editPolicy.hourlyWriteLimit > (editKey.hourly_write_limit ?? 30) ||
      editPolicy.dailyWriteLimit > (editKey.daily_write_limit ?? 200) ||
      selectedChannelIds.some((channelId) => !originalChannelIds.includes(channelId));
    if (increasesPrivilege && !window.confirm(
      'This change may increase what the external integration can view or request. Continue?'
    )) return;
    setSavingPolicy(true);
    try {
      const response = await fetch(`/api/keys/${editKey.id}/external-access`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token,
        },
        body: JSON.stringify({
          policy: editPolicy,
          channelIds: selectedChannelIds,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to save external access');
      setSnackbar({ open: true, message: 'External access updated' });
      setEditKey(null);
      await fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save external access');
    } finally {
      setSavingPolicy(false);
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
        setSnackbar({ open: true, message: 'API key revoked' });
        fetchApiKeys();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to revoke API key');
      }
    } catch (err) {
      setError('Failed to revoke API key');
    } finally {
      setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' });
    }
  };

  const openDeleteConfirmDialog = (id: number, name: string) => {
    setDeleteConfirmDialog({ open: true, keyId: id, keyName: name });
  };

  const handleRegenerateKey = async () => {
    if (!token || !regenerateConfirmDialog.key) return;
    const key = regenerateConfirmDialog.key;
    setRegenerating(true);
    try {
      const response = await fetch(`/api/keys/${key.id}/regenerate`, {
        method: 'POST',
        headers: { 'x-access-token': token },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to regenerate API key');
      setRegenerateConfirmDialog({ open: false, key: null });
      setCreatedKey(body);
      setCreatedKeyRole(key.role);
      setCreatedKeyAction('regenerated');
      setCreatedKeyDialogOpen(true);
      await fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate API key');
    } finally {
      setRegenerating(false);
    }
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

  if (loading) {
    return (
      <ConfigurationAccordion title="API Keys & External Access">
        <Skeleton variant="rectangular" height={200} />
      </ConfigurationAccordion>
    );
  }

  const externalKeys = apiKeys.filter((key) => key.role !== 'legacy_download');
  const legacyKeys = apiKeys.filter((key) => key.role === 'legacy_download');
  const normalizedExternalKeySearch = externalKeySearch.trim().toLocaleLowerCase();
  const visibleExternalKeys = externalKeys
    .filter((key) => !showActiveExternalKeys || (key.is_active && !key.revoked_at))
    .filter((key) => !normalizedExternalKeySearch ||
      key.name.toLocaleLowerCase().includes(normalizedExternalKeySearch))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return (
    <ConfigurationAccordion
      title="API Keys & External Access"
      statusBanner={{
        enabled: showRequestsNavLink,
        label: 'Show Requests in navigation',
        onToggle: onShowRequestsNavLinkChange,
        onText: 'Requests navigation link shown',
        offText: 'Requests navigation link hidden',
        toggleTestId: 'requests-nav-link-switch',
      }}
    >
      <Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography variant="subtitle1">External access keys</Typography>
          <Typography variant="body2" color="secondary" className="mt-1 max-w-2xl">
            Every external key can view its approved channels. Add only the request permissions
            the integration needs.
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<AddIcon size={16} />}
          onClick={() => openCreateDialog('external')}
          size="small"
        >
          Create external key
        </Button>
      </Box>

      {isHttpWarning && (
        <Alert severity="warning" className="mb-4" icon={<WarningIcon size={20} />}>
          Creating API keys over HTTP is insecure. Use HTTPS in production.
        </Alert>
      )}

      {error && (
        <Alert severity="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {externalKeys.length > 0 && (
        <Box className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-stretch">
          <TextField
            label="Search external access keys"
            value={externalKeySearch}
            onChange={(event) => setExternalKeySearch(event.target.value)}
            fullWidth
            size="small"
          />
          <Button
            variant={showActiveExternalKeys ? 'contained' : 'outlined'}
            startIcon={<FilterIcon size={16} />}
            onClick={() => setShowActiveExternalKeys((current) => !current)}
            aria-pressed={showActiveExternalKeys}
            size="small"
            className="shrink-0 self-start sm:self-stretch"
            style={{ height: 'auto' }}
          >
            Active only
          </Button>
        </Box>
      )}

      {externalKeys.length === 0 ? (
        <Paper className="border border-dashed border-border p-6 text-center shadow-none">
          <Typography color="secondary">
            No external access keys yet.
          </Typography>
        </Paper>
      ) : visibleExternalKeys.length === 0 ? (
        <Paper className="border border-dashed border-border p-6 text-center shadow-none">
          <Typography color="secondary">
            No external access keys match the current search and filter.
          </Typography>
        </Paper>
      ) : (
        <div className="grid gap-3" aria-label="External API key cards">
          {visibleExternalKeys.map((key) => {
            const rawChannelGrantCount = key.channel_grant_count;
            const channelGrantCount = typeof rawChannelGrantCount === 'number' &&
              Number.isInteger(rawChannelGrantCount) && rawChannelGrantCount >= 0
              ? rawChannelGrantCount
              : null;
            const permissions = permissionsFromKey(key);
            const ratingBand = getExternalRatingBand(key.max_rating_level);
            const movieCeiling = ratingBand.movieRatings[ratingBand.movieRatings.length - 1];
            const tvCeiling = ratingBand.tvRatings[ratingBand.tvRatings.length - 1];
            const permissionChips = [
              permissions.allowVideoRequests && {
                label: key.auto_approve_video_requests ? 'Videos · Auto' : 'Videos',
                title: key.auto_approve_video_requests
                  ? 'Video requests are enabled and auto-approved after policy checks.'
                  : 'Video requests are enabled and require administrator approval.',
                icon: <VideoIcon size={13} />,
                auto: key.auto_approve_video_requests,
              },
              permissions.allowChannelRequests && {
                label: key.auto_approve_channel_requests ? 'Channels · Auto' : 'Channels',
                title: key.auto_approve_channel_requests
                  ? 'Channel requests are enabled and auto-approved after policy checks.'
                  : 'Channel requests are enabled and require administrator approval.',
                icon: <ChannelIcon size={13} />,
                auto: key.auto_approve_channel_requests,
              },
              permissions.allowDeleteVideoRequests && {
                label: key.auto_approve_delete_requests ? 'Delete · Auto' : 'Delete video',
                title: key.auto_approve_delete_requests
                  ? 'Downloaded-video deletion requests are enabled and auto-approved after policy checks.'
                  : 'Downloaded-video deletion requests are enabled and require administrator approval.',
                icon: <DeleteIcon size={13} />,
                auto: key.auto_approve_delete_requests,
              },
            ].filter(Boolean) as Array<{
              label: string;
              title: string;
              icon: React.ReactElement;
              auto: boolean;
            }>;

            return (
              <Paper
                key={key.id}
                className="flex flex-col gap-3 border border-border p-4 shadow-none sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography variant="subtitle2" className="mr-1 truncate">
                      {key.name}
                    </Typography>
                    {key.revoked_at && (
                      <Chip label="Revoked" size="small" color="error" variant="outlined" />
                    )}
                    <RatingBadge
                      rating={movieCeiling}
                      ratingSource={`Movie ceiling: ${ratingBand.movieRatings.join(' / ')}`}
                      ariaLabel={`Movie rating ceiling ${movieCeiling}`}
                    />
                    <RatingBadge
                      rating={tvCeiling}
                      ratingSource={`TV ceiling: ${ratingBand.tvRatings.join(' / ')}`}
                      ariaLabel={`TV rating ceiling ${tvCeiling}`}
                    />
                    {key.allow_unrated && (
                      <RatingBadge rating={null} showNA ariaLabel="Unrated content allowed" />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip
                      label={channelGrantCount === null
                        ? 'Approved channel count unavailable'
                        : `${channelGrantCount} approved ${channelGrantCount === 1 ? 'channel' : 'channels'}`}
                      size="small"
                      color={channelGrantCount === 0 ? 'warning' : 'default'}
                      variant="outlined"
                    />
                    {permissionChips.length === 0 ? (
                      <Tooltip title="Catalog viewing and request-status access only.">
                        <Chip
                          label="View only"
                          size="small"
                          variant="outlined"
                          icon={<ViewIcon size={13} />}
                        />
                      </Tooltip>
                    ) : permissionChips.map((permission) => (
                      <Tooltip key={permission.label} title={permission.title}>
                        <Chip
                          label={permission.label}
                          size="small"
                          variant="outlined"
                          color={permission.auto ? 'primary' : 'default'}
                          icon={permission.auto
                            ? <AutoApproveIcon size={13} />
                            : permission.icon}
                        />
                      </Tooltip>
                    ))}
                  </div>
                  {channelGrantCount === 0 && (
                    <Alert severity="warning" className="mt-3" icon={<WarningIcon size={18} />}>
                      No approved channels. This key cannot view or request catalog content until you add grants.
                    </Alert>
                  )}
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <div className="min-w-0 text-left sm:text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                      <ClockIcon size={13} aria-hidden="true" />
                      Last used
                    </div>
                    <Typography variant="body2" className="whitespace-nowrap">
                      {formatDate(key.last_used_at)}
                    </Typography>
                  </div>
                  <div className="flex items-center">
                    {!key.revoked_at && (
                      <Tooltip title="Edit external access">
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(key)}
                          aria-label={`Edit ${key.name} external access`}
                        >
                          <EditIcon size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {!key.revoked_at && (
                      <Tooltip title="Regenerate key">
                        <IconButton
                          size="small"
                          onClick={() => setRegenerateConfirmDialog({ open: true, key })}
                          aria-label={`Regenerate ${key.name}`}
                        >
                          <RegenerateIcon size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {!key.revoked_at && (
                      <Tooltip title="Revoke">
                        <IconButton
                          size="small"
                          onClick={() => openDeleteConfirmDialog(key.id, key.name)}
                          color="error"
                          aria-label={`Revoke ${key.name}`}
                        >
                          <DeleteIcon size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Paper>
            );
          })}
        </div>
      )}

      <Divider className="my-6" />

      <Box className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography variant="subtitle1">Legacy download keys</Typography>
          <Typography variant="body2" color="secondary" className="mt-1 max-w-2xl">
            For the deprecated bookmarklet and <code>/api/videos/download</code> workflow only.
            Legacy keys cannot access <code>/external-api/v1</code>.
          </Typography>
        </div>
        <Button
          variant="outlined"
          startIcon={<AddIcon size={16} />}
          onClick={() => openCreateDialog('legacy')}
          size="small"
        >
          Create legacy key
        </Button>
      </Box>

      <Box className="mb-4 flex items-center">
        <TextField
          type="number"
          label="Legacy rate limit (requests/min)"
          value={apiKeyRateLimit}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 100) {
              onRateLimitChange(val);
            }
          }}
          inputProps={{ min: 1, max: 100 }}
          size="small"
          className="w-[240px]"
        />
        <InfoTooltip text="Maximum bookmarklet download requests per minute for each legacy key." />
      </Box>

      {legacyKeys.length === 0 ? (
        <Typography variant="body2" color="secondary">
          No legacy download keys.
        </Typography>
      ) : (
        <div className="grid gap-2" aria-label="Legacy API key rows">
          {legacyKeys.map((key) => (
            <Paper
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-border p-3 shadow-none"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Typography variant="subtitle2" className="truncate">{key.name}</Typography>
                  <Chip
                    label={key.revoked_at ? 'Revoked' : 'Legacy download'}
                    size="small"
                    color={key.revoked_at ? 'error' : 'default'}
                    variant="outlined"
                  />
                  <Chip
                    label={`${key.usage_count} ${key.usage_count === 1 ? 'use' : 'uses'}`}
                    size="small"
                    variant="outlined"
                  />
                </div>
                <Typography variant="caption" color="secondary">
                  Last used {formatDate(key.last_used_at)}
                </Typography>
              </div>
              {!key.revoked_at && (
                <Tooltip title="Revoke">
                  <IconButton
                    size="small"
                    onClick={() => openDeleteConfirmDialog(key.id, key.name)}
                    color="error"
                    aria-label={`Revoke ${key.name}`}
                  >
                    <DeleteIcon size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </Paper>
          ))}
        </div>
      )}

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {createKeyType === 'legacy' ? 'Create Legacy Download Key' : 'Create External Access Key'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Key Name"
            placeholder={createKeyType === 'legacy' ? 'e.g., Bookmarklet' : 'e.g., External Client'}
            fullWidth
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            inputProps={{ maxLength: 100 }}
            helperText="A descriptive name to identify this key"
          />
          {createKeyType === 'external' && (
            <>
              <Typography variant="subtitle2" className="mt-4 mb-2">Access policy</Typography>
              <PolicyEditor
                policy={newKeyPolicy}
                onChange={changeNewKeyPolicy}
              />
              <Divider className="my-5" />
              <Typography variant="subtitle2" className="mb-2">
                Approved channels ({newKeyChannelIds.length})
              </Typography>
              <Typography variant="body2" color="secondary" className="mb-3">
                The key cannot browse or request from channels that are not selected.
              </Typography>
              {newKeyChannelIds.length === 0 && (
                <Alert severity="warning" className="mb-3" icon={<WarningIcon size={18} />}>
                  Saving with zero approved channels is allowed, but the key will fail closed and cannot view or request catalog content until grants are added.
                </Alert>
              )}
              {channelOptions.length > 0 && (
                <FormControlLabel
                  control={<Checkbox
                    checked={newKeyChannelIds.length === channelOptions.length}
                    indeterminate={newKeyChannelIds.length > 0 &&
                      newKeyChannelIds.length < channelOptions.length}
                    onChange={(event) => setNewKeyChannelIds(event.target.checked
                      ? channelOptions.map((channel) => channel.database_id as number)
                        .sort((a, b) => a - b)
                      : []
                    )}
                  />}
                  label="Select all approved channels"
                />
              )}
              <TextField
                label="Search channels for new key"
                value={newKeyChannelSearch}
                onChange={(event) => setNewKeyChannelSearch(event.target.value)}
                fullWidth
                size="small"
                className="mb-3"
              />
              {channelOptions.length === 0 ? (
                <Typography variant="body2" color="secondary">
                  No enabled, non-terminated channels are available.
                </Typography>
              ) : (
                <Box className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[240px] overflow-auto">
                  {channelOptions.filter((channel) => {
                    const query = newKeyChannelSearch.trim().toLowerCase();
                    if (!query) return true;
                    return [channel.title, channel.uploader, channel.channel_id]
                      .filter(Boolean)
                      .some((value) => value?.toLowerCase().includes(query));
                  }).map((channel) => {
                    const databaseId = channel.database_id as number;
                    return (
                      <FormControlLabel
                        key={databaseId}
                        control={<Checkbox
                          checked={newKeyChannelIds.includes(databaseId)}
                          onChange={(event) => setNewKeyChannelIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, databaseId])].sort((a, b) => a - b)
                              : current.filter((id) => id !== databaseId)
                          )}
                        />}
                        label={channel.title || channel.uploader ||
                          channel.channel_id || `Channel ${databaseId}`}
                      />
                    );
                  })}
                </Box>
              )}
            </>
          )}
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

      <Dialog
        open={Boolean(editKey)}
        onClose={() => setEditKey(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit External Access — {editKey?.name}</DialogTitle>
        <DialogContent>
          <Alert severity="info" className="mb-4">
            Permissions, policy, and channel grants are enforced by Youtarr on every request.
          </Alert>
          <PolicyEditor policy={editPolicy} onChange={setEditPolicy} />
          <Divider className="my-5" />
          <Typography variant="subtitle2" className="mb-2">
            Approved channels ({selectedChannelIds.length})
          </Typography>
          {selectedChannelIds.length === 0 && (
            <Alert severity="warning" className="mb-3" icon={<WarningIcon size={18} />}>
              Saving with zero approved channels is allowed, but this key will fail closed and cannot view or request catalog content until grants are added.
            </Alert>
          )}
          {channelOptions.length > 0 && (
            <FormControlLabel
              control={<Checkbox
                checked={selectedChannelIds.length === channelOptions.length}
                indeterminate={selectedChannelIds.length > 0 &&
                  selectedChannelIds.length < channelOptions.length}
                onChange={(event) => setSelectedChannelIds(event.target.checked
                  ? channelOptions.map((channel) => channel.database_id as number)
                    .sort((a, b) => a - b)
                  : []
                )}
              />}
              label="Select all approved channels"
            />
          )}
          <TextField
            label="Search channels"
            value={channelSearch}
            onChange={(event) => setChannelSearch(event.target.value)}
            fullWidth
            size="small"
            className="mb-3"
          />
          {channelOptions.length === 0 ? (
            <Typography variant="body2" color="secondary">
              No enabled, non-terminated channels are available.
            </Typography>
          ) : (
            <Box className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[320px] overflow-auto">
              {channelOptions.filter((channel) => {
                const query = channelSearch.trim().toLowerCase();
                if (!query) return true;
                return [channel.title, channel.uploader, channel.channel_id]
                  .filter(Boolean)
                  .some((value) => value?.toLowerCase().includes(query));
              }).map((channel) => {
                const databaseId = channel.database_id as number;
                return (
                  <FormControlLabel
                    key={databaseId}
                    control={<Checkbox
                      checked={selectedChannelIds.includes(databaseId)}
                      onChange={(event) => setSelectedChannelIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, databaseId])].sort((a, b) => a - b)
                          : current.filter((id) => id !== databaseId)
                      )}
                    />}
                    label={channel.title || channel.uploader || channel.channel_id || `Channel ${databaseId}`}
                  />
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditKey(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveExternalAccess} disabled={savingPolicy}>
            {savingPolicy ? 'Saving…' : 'Save External Access'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Key Created Dialog */}
      <Dialog
        open={createdKeyDialogOpen}
        onClose={() => setCreatedKeyDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          ✓ API Key {createdKeyAction === 'regenerated' ? 'Regenerated' : 'Created'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="mb-6">
            Save this key now - it will not be shown again!
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            Your API Key
          </Typography>
          <Paper
            className="p-4 mb-6 flex items-center justify-between bg-muted/50 font-mono break-all"
          >
            <code>{createdKey?.key}</code>
            <IconButton
              onClick={() => copyToClipboard(createdKey?.key || '', 'API key')}
              size="small"
            >
              <ContentCopyIcon size={16} />
            </IconButton>
          </Paper>

          {createdKeyRole === 'legacy_download' ? (
            <Paper className="p-4 bg-muted/50">
              <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
                <strong>API endpoint:</strong> {locationUtils.getOrigin()}/api/videos/download
              </Typography>
            </Paper>
          ) : (
            <Paper className="p-4 bg-muted/50">
              <Typography variant="body2" className="mb-2">
                Use this key only with <strong>{locationUtils.getOrigin()}/external-api/v1</strong>.
              </Typography>
              <Typography variant="body2" color="secondary">
                Add channel grants from this key&apos;s edit action before connecting an external client.
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatedKeyDialogOpen(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={regenerateConfirmDialog.open}
        onClose={() => !regenerating &&
          setRegenerateConfirmDialog({ open: false, key: null })}
      >
        <DialogTitle>Regenerate API Key?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="mb-3">
            The current key will stop working immediately.
          </Alert>
          <Typography>
            Regenerate <strong>&quot;{regenerateConfirmDialog.key?.name}&quot;</strong>?
          </Typography>
          <Typography variant="body2" color="secondary" className="mt-2">
            Its permissions and approved channels will stay the same. The replacement key is
            shown only once, so copy it before closing the next dialog.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRegenerateConfirmDialog({ open: false, key: null })}
            disabled={regenerating}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleRegenerateKey}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating…' : 'Regenerate Key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' })}
      >
        <DialogTitle>Revoke API Key?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke the API key <strong>"{deleteConfirmDialog.keyName}"</strong>?
          </Typography>
          <Typography variant="body2" color="secondary" className="mt-2">
            Any integration using this key will stop working immediately. Its audit history is retained.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmDialog({ open: false, keyId: null, keyName: '' })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteKey} color="error" variant="contained">
            Revoke
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
