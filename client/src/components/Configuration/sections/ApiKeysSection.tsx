import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import PolicyEditor from './ApiKeysSection/PolicyEditor';
import ChannelGrantPicker from './ApiKeysSection/ChannelGrantPicker';
import { ApiKey, ApiKeyPolicy, ApiKeyRole, ApiKeyCreatedResponse, normalizePolicy, useApiKeys } from './ApiKeysSection/useApiKeys';
import {
  EXTERNAL_RATING_BANDS,
  formatExternalRatingBand,
  getExternalRatingBand,
} from '../../../utils/externalRatingPolicy';
import RatingBadge from '../../shared/RatingBadge';

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

interface ApiKeysSectionProps {
  token: string | null;
  apiKeyRateLimit: number;
  onRateLimitChange: (value: number) => void;
  externalApiEnabled?: boolean;
  showRequestsNavLink: boolean;
  onShowRequestsNavLinkChange: (value: boolean) => void;
}

const ApiKeysSection: React.FC<ApiKeysSectionProps> = ({
  token,
  apiKeyRateLimit,
  onRateLimitChange,
  externalApiEnabled = true,
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
  const [channelOptions, setChannelOptions] = useState<import('../../../../types/Channel').Channel[]>([]);
  const [channelSearch, setChannelSearch] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([]);
  const [originalChannelIds, setOriginalChannelIds] = useState<number[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [channelsLoadError, setChannelsLoadError] = useState<string | null>(null);
  const [grantsLoadError, setGrantsLoadError] = useState<string | null>(null);
  const editLoadSequence = useRef(0);
  const apiKeyApi = useApiKeys(token);
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

  const fetchApiKeys = useCallback(async () => {
    try {
      setApiKeys(await apiKeyApi.fetchApiKeys());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  }, [apiKeyApi]);

  useEffect(() => {
    void fetchApiKeys();
  }, [fetchApiKeys]);

  const loadAvailableChannels = async () => {
    setChannelsLoading(true);
    setEditLoadError(null);
    try {
      const channels = await apiKeyApi.fetchAvailableChannels();
      setChannelOptions(channels.filter((channel) => channel.database_id && !channel.terminated_at));
    } catch (err) {
      setEditLoadError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setChannelsLoading(false);
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
      const data = await apiKeyApi.createApiKey(
        newKeyName.trim(),
        createKeyType === 'legacy' ? undefined : newKeyPolicy,
        createKeyType === 'legacy' ? undefined : newKeyChannelIds
      );
      if (data.success) {
        setCreatedKey(data);
        setCreatedKeyAction('created');
        setCreatedKeyRole(createKeyType === 'legacy' ? 'legacy_download' : newKeyPolicy.role);
        setCreateDialogOpen(false);
        setCreatedKeyDialogOpen(true);
        setNewKeyName('');
        setNewKeyPolicy(defaultPolicy);
        setNewKeyChannelIds([]);
        setNewKeyChannelSearch('');
        void fetchApiKeys();
      } else {
        setError(data.message || 'Failed to create API key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    }
  };

  const loadEditData = useCallback(async (key: ApiKey) => {
    const sequence = ++editLoadSequence.current;
    setChannelsLoading(true);
    setGrantsLoading(true);
    setChannelsLoadError(null);
    setGrantsLoadError(null);
    setEditLoadError(null);
    const [grantsResult, channelsResult] = await Promise.allSettled([
      apiKeyApi.fetchChannelGrants(key.id),
      apiKeyApi.fetchAvailableChannels(),
    ]);
    if (sequence !== editLoadSequence.current) return;
    const nextGrantsError = grantsResult.status === 'rejected'
      ? (grantsResult.reason instanceof Error ? grantsResult.reason.message : 'Failed to load channel grants')
      : null;
    const nextChannelsError = channelsResult.status === 'rejected'
      ? (channelsResult.reason instanceof Error ? channelsResult.reason.message : 'Failed to load channels')
      : null;
    setGrantsLoadError(nextGrantsError);
    setChannelsLoadError(nextChannelsError);
    setEditLoadError(nextGrantsError || nextChannelsError);
    if (grantsResult.status === 'fulfilled') {
      setSelectedChannelIds(grantsResult.value);
      setOriginalChannelIds(grantsResult.value);
    }
    if (channelsResult.status === 'fulfilled') {
      setChannelOptions(channelsResult.value.filter((channel) => channel.database_id && !channel.terminated_at));
    }
    setChannelsLoading(false);
    setGrantsLoading(false);
  }, [apiKeyApi]);

  const openEditDialog = (key: ApiKey) => {
    if (!token || key.role === 'legacy_download' || key.revoked_at) return;
    ++editLoadSequence.current;
    setEditKey(key);
    setEditPolicy(policyFromKey(key));
    setSelectedChannelIds([]);
    setOriginalChannelIds([]);
    setChannelSearch('');
    void loadEditData(key);
  };

  const closeEditDialog = () => {
    ++editLoadSequence.current;
    setEditKey(null);
    setEditLoadError(null);
    setChannelsLoadError(null);
    setGrantsLoadError(null);
    setChannelsLoading(false);
    setGrantsLoading(false);
  };

  const saveExternalAccess = async () => {
    if (!token || !editKey || channelsLoading || grantsLoading || editLoadError) return;
    const normalized = normalizePolicy(editPolicy);
    if (!normalized.policy) {
      setEditLoadError(normalized.error || 'Invalid policy values');
      return;
    }
    const normalizedPolicy = normalized.policy;
    const increasesPrivilege =
      (normalizedPolicy.allowVideoRequests && !permissionsFromKey(editKey).allowVideoRequests) ||
      (normalizedPolicy.allowChannelRequests && !permissionsFromKey(editKey).allowChannelRequests) ||
      (normalizedPolicy.allowDeleteVideoRequests && !permissionsFromKey(editKey).allowDeleteVideoRequests) ||
      (normalizedPolicy.autoApproveVideoRequests && !editKey.auto_approve_video_requests) ||
      (normalizedPolicy.autoApproveChannelRequests && !editKey.auto_approve_channel_requests) ||
      (normalizedPolicy.autoApproveDeleteRequests && !editKey.auto_approve_delete_requests) ||
      normalizedPolicy.maxRatingLevel > editKey.max_rating_level ||
      (normalizedPolicy.allowUnrated && !editKey.allow_unrated) ||
      normalizedPolicy.allowedMediaTypes.some(
        (mediaType) => !editKey.allowed_media_types.includes(mediaType)
      ) ||
      normalizedPolicy.maxActiveJobs > (editKey.max_active_jobs ?? 5) ||
      normalizedPolicy.hourlyWriteLimit > (editKey.hourly_write_limit ?? 30) ||
      normalizedPolicy.dailyWriteLimit > (editKey.daily_write_limit ?? 200) ||
      selectedChannelIds.some((channelId) => !originalChannelIds.includes(channelId));
    if (increasesPrivilege && !window.confirm(
      'This change may increase what the external integration can view or request. Continue?'
    )) return;
    setSavingPolicy(true);
    try {
      await apiKeyApi.updateExternalAccess(editKey.id, { policy: normalizedPolicy, channelIds: selectedChannelIds });
      setSnackbar({ open: true, message: 'External access updated' });
      closeEditDialog();
      await fetchApiKeys();
    } catch (err) {
      setEditLoadError(err instanceof Error ? err.message : 'Failed to save external access');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!token || !deleteConfirmDialog.keyId) return;
    try {
      await apiKeyApi.revokeApiKey(deleteConfirmDialog.keyId);
      setSnackbar({ open: true, message: 'API key revoked' });
      void fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
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
      const body = await apiKeyApi.regenerateApiKey(key.id);
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
      statusBanner={externalApiEnabled ? {
        enabled: showRequestsNavLink,
        label: 'Show Requests in navigation',
        onToggle: onShowRequestsNavLinkChange,
        onText: 'Requests navigation link shown',
        offText: 'Requests navigation link hidden',
        toggleTestId: 'requests-nav-link-switch',
      } : undefined}
    >
      {externalApiEnabled ? (
        <>
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

        </>
      ) : (
        <Alert severity="info" className="mb-4">
          External API access is disabled by the EXTERNAL_API_ENABLED environment setting.
        </Alert>
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
              <ChannelGrantPicker channels={channelOptions} selectedIds={newKeyChannelIds} search={newKeyChannelSearch} onSearchChange={setNewKeyChannelSearch} onSelectedIdsChange={setNewKeyChannelIds} />
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
        onClose={closeEditDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit External Access — {editKey?.name}</DialogTitle>
        <DialogContent>
          <Alert severity="info" className="mb-4">
            Permissions, policy, and channel grants are enforced by Youtarr on every request.
          </Alert>
          {editLoadError && (
            <Alert severity="error" className="mb-4">
              <div className="space-y-2">
                <Typography variant="body2">{channelsLoadError || grantsLoadError || editLoadError}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => editKey && void loadEditData(editKey)}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}
          {!editLoadError && (channelsLoading || grantsLoading) && (
            <Alert severity="info" className="mb-4">
              Loading channel grants and available channels...
            </Alert>
          )}
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
          <ChannelGrantPicker channels={channelOptions} selectedIds={selectedChannelIds} search={channelSearch} onSearchChange={setChannelSearch} onSelectedIdsChange={setSelectedChannelIds} maxHeight="320px" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveExternalAccess}
            disabled={savingPolicy || channelsLoading || grantsLoading || Boolean(editLoadError) || !editKey}
          >
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
