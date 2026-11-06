import React from 'react';
import {
  Alert,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '../../../ui';
import {
  Trash2 as DeleteIcon,
  AlertTriangle as WarningIcon,
  Pencil as EditIcon,
  RefreshCw as RegenerateIcon,
  Video as VideoIcon,
  Radio as ChannelIcon,
  Clock3 as ClockIcon,
  Zap as AutoApproveIcon,
  Eye as ViewIcon,
} from 'lucide-react';
import { getExternalRatingBand } from '../../../../utils/externalRatingPolicy';
import RatingBadge from '../../../shared/RatingBadge';
import { ApiKey } from './useApiKeys';
import { permissionsFromKey } from './policy';

export const formatKeyDate = (dateStr: string | null) => {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface Props {
  apiKey: ApiKey;
  onEdit: (key: ApiKey) => void;
  onRegenerate: (key: ApiKey) => void;
  onRevoke: (id: number, name: string) => void;
}
export default function ExternalKeyCard({
  apiKey: key,
  onEdit,
  onRegenerate,
  onRevoke,
}: Props) {
  const rawChannelGrantCount = key.channel_grant_count;
  const channelGrantCount =
    typeof rawChannelGrantCount === 'number' &&
    Number.isInteger(rawChannelGrantCount) &&
    rawChannelGrantCount >= 0
      ? rawChannelGrantCount
      : null;
  const permissions = permissionsFromKey(key);
  const ratingBand = getExternalRatingBand(key.max_rating_level);
  const movieCeiling =
    ratingBand.movieRatings[ratingBand.movieRatings.length - 1];
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
      label: key.auto_approve_delete_requests
        ? 'Delete · Auto'
        : 'Delete video',
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
            <Chip
              label="Revoked"
              size="small"
              color="error"
              variant="outlined"
            />
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
            <RatingBadge
              rating={null}
              showNA
              ariaLabel="Unrated content allowed"
            />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip
            label={
              channelGrantCount === null
                ? 'Approved channel count unavailable'
                : `${channelGrantCount} approved ${channelGrantCount === 1 ? 'channel' : 'channels'}`
            }
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
          ) : (
            permissionChips.map((permission) => (
              <Tooltip key={permission.label} title={permission.title}>
                <Chip
                  label={permission.label}
                  size="small"
                  variant="outlined"
                  color={permission.auto ? 'primary' : 'default'}
                  icon={
                    permission.auto ? (
                      <AutoApproveIcon size={13} />
                    ) : (
                      permission.icon
                    )
                  }
                />
              </Tooltip>
            ))
          )}
        </div>
        {channelGrantCount === 0 && (
          <Alert
            severity="warning"
            className="mt-3"
            icon={<WarningIcon size={18} />}
          >
            No approved channels. This key cannot view or request catalog
            content until you add grants.
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
            {formatKeyDate(key.last_used_at)}
          </Typography>
        </div>
        <div className="flex items-center">
          {!key.revoked_at && (
            <Tooltip title="Edit external access">
              <IconButton
                size="small"
                onClick={() => onEdit(key)}
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
                onClick={() => onRegenerate(key)}
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
                onClick={() => onRevoke(key.id, key.name)}
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
}
