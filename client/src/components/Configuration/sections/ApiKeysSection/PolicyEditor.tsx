import React from 'react';
import { Box, Typography, Paper, Tooltip, Chip, TextField, Switch, FormControlLabel, Select, MenuItem } from '../../../ui';
import { Video as ViewIcon } from 'lucide-react';
import { EXTERNAL_RATING_BANDS, formatExternalRatingBand } from '../../../../utils/externalRatingPolicy';
import { ApiKeyPolicy, MediaType, ApiKeyRole } from './useApiKeys';

const roleForPolicy = (policy: ApiKeyPolicy): ApiKeyRole => {
  if (policy.role === 'admin') return 'admin';
  if (policy.allowDeleteVideoRequests) return 'delete';
  if (policy.allowVideoRequests || policy.allowChannelRequests) return 'request';
  return 'view';
};

interface PolicyEditorProps {
  policy: ApiKeyPolicy;
  onChange: (policy: ApiKeyPolicy) => void;
}

const PolicyEditor: React.FC<PolicyEditorProps> = ({ policy, onChange }) => {
  const updatePolicy = (changes: Partial<ApiKeyPolicy>) => {
    const next = { ...policy, ...changes };
    onChange({ ...next, role: roleForPolicy(next) });
  };
  const togglePermission = (
    permission: 'allowVideoRequests' | 'allowChannelRequests' | 'allowDeleteVideoRequests',
    autoApprove: 'autoApproveVideoRequests' | 'autoApproveChannelRequests' | 'autoApproveDeleteRequests',
    enabled: boolean
  ) => updatePolicy({ [permission]: enabled, ...(!enabled ? { [autoApprove]: false } : {}) });
  const toggleMedia = (mediaType: MediaType) => {
    const selected = policy.allowedMediaTypes.includes(mediaType);
    if (selected && policy.allowedMediaTypes.length === 1) return;
    updatePolicy({ allowedMediaTypes: selected
      ? policy.allowedMediaTypes.filter((value) => value !== mediaType)
      : [...policy.allowedMediaTypes, mediaType] });
  };
  const workload = [
    ['maxActiveJobs', 'Active jobs', 1, 5],
    ['hourlyWriteLimit', 'Writes per hour', 1, 30],
    ['dailyWriteLimit', 'Writes per day', 1, 200],
  ] as const;
  return <Box className="mt-4 space-y-5">
    <Box className="space-y-1">
      <Typography variant="caption" color="secondary">Maximum allowed rating</Typography>
      <Select fullWidth aria-label="Maximum allowed rating" inputProps={{ 'aria-label': 'Maximum allowed rating' }} value={policy.maxRatingLevel} onChange={(event) => updatePolicy({ maxRatingLevel: Number(event.target.value) })}>
        {EXTERNAL_RATING_BANDS.map((band) => <MenuItem key={band.level} value={band.level}>{formatExternalRatingBand(band.level)}</MenuItem>)}
      </Select>
      <Typography variant="caption" color="secondary">Uses the video rating first, then the channel&apos;s manually assigned default.</Typography>
    </Box>
    <Box className="space-y-2">
      <Typography variant="subtitle2">Content access</Typography>
      <FormControlLabel control={<Switch checked={policy.allowUnrated} onChange={(event) => updatePolicy({ allowUnrated: event.target.checked })} />} label="Allow unrated or unrecognized ratings" />
      <Box className="flex flex-wrap gap-x-5 gap-y-2">{(['video', 'short', 'livestream'] as MediaType[]).map((mediaType) => <FormControlLabel key={mediaType} control={<Switch size="small" checked={policy.allowedMediaTypes.includes(mediaType)} onChange={() => toggleMedia(mediaType)} />} label={mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} />)}</Box>
    </Box>
    <Box className="space-y-2">
      <div className="flex items-center gap-2"><Typography variant="subtitle2">Request permissions</Typography><Tooltip title="Catalog viewing and request-status access are included with every external key."><Chip size="small" variant="outlined" icon={<ViewIcon size={13} />} label="View included" /></Tooltip></div>
      {[
        ['allowVideoRequests', 'autoApproveVideoRequests', 'Request videos', 'Submit requests to download eligible videos.'],
        ['allowChannelRequests', 'autoApproveChannelRequests', 'Request channels', 'Submit requests to add supported YouTube channels.'],
        ['allowDeleteVideoRequests', 'autoApproveDeleteRequests', 'Delete downloaded videos', 'Submit approval-backed requests to remove downloaded video assets.'],
      ].map(([permission, autoApprove, label, description]) => {
        const enabled = policy[permission as keyof ApiKeyPolicy] as boolean;
        return <Paper key={permission} className="border border-border bg-muted/20 p-3 shadow-none"><div className="flex items-start justify-between gap-4"><div><Typography variant="body2" className="font-medium">{label}</Typography><Typography variant="caption" color="secondary">{description}</Typography></div><Switch checked={enabled} onChange={(event) => togglePermission(permission as any, autoApprove as any, event.target.checked)} aria-label={label} /></div>{enabled && <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3"><div><Typography variant="body2">Auto-approve</Typography><Typography variant="caption" color="secondary">Skip manual review when all current policy checks pass.</Typography></div><Switch checked={policy[autoApprove as keyof ApiKeyPolicy] as boolean} onChange={(event) => updatePolicy({ [autoApprove]: event.target.checked } as Partial<ApiKeyPolicy>)} aria-label={`Auto-approve ${String(label).toLowerCase()}`} /></div>}</Paper>;
      })}
    </Box>
    <Box className="space-y-2"><Typography variant="subtitle2">Workload limits</Typography><Typography variant="caption" color="secondary">Durable per-key ceilings. Limits can be reduced below the system defaults.</Typography><div className="grid gap-3 sm:grid-cols-3">{workload.map(([field, label, min, max]) => <TextField key={field} type="number" label={label} value={policy[field]} inputProps={{ min, max }} onChange={(event) => updatePolicy({ [field]: event.target.value } as Partial<ApiKeyPolicy>)} />)}</div></Box>
  </Box>;
};

export default PolicyEditor;

