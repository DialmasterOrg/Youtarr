import React from 'react';
import { Box, Checkbox, FormControlLabel, TextField, Typography } from '../../../ui';
import { Channel } from '../../../../types/Channel';

interface ChannelGrantPickerProps {
  channels: Channel[];
  selectedIds: number[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelectedIdsChange: (ids: number[]) => void;
  label?: string;
  maxHeight?: string;
}

const channelLabel = (channel: Channel) => channel.title || channel.uploader || channel.channel_id || `Channel ${channel.database_id}`;

const ChannelGrantPicker: React.FC<ChannelGrantPickerProps> = ({
  channels,
  selectedIds,
  search,
  onSearchChange,
  onSelectedIdsChange,
  label = 'Search channels',
  maxHeight = '240px',
}) => {
  const visibleChannels = channels.filter((channel) => {
    const query = search.trim().toLowerCase();
    return !query || [channel.title, channel.uploader, channel.channel_id].filter(Boolean).some((value) => value?.toLowerCase().includes(query));
  });
  const ids = channels.map((channel) => channel.database_id).filter((id): id is number => typeof id === 'number');
  const update = (id: number, checked: boolean) => onSelectedIdsChange(checked
    ? [...new Set([...selectedIds, id])].sort((a, b) => a - b)
    : selectedIds.filter((value) => value !== id));
  return <>
    {channels.length > 0 && <FormControlLabel control={<Checkbox checked={selectedIds.length === ids.length} indeterminate={selectedIds.length > 0 && selectedIds.length < ids.length} onChange={(event) => onSelectedIdsChange(event.target.checked ? ids : [])} />} label="Select all approved channels" />}
    <TextField label={label} value={search} onChange={(event) => onSearchChange(event.target.value)} fullWidth size="small" className="mb-3" />
    {channels.length === 0 ? <Typography variant="body2" color="secondary">No enabled, non-terminated channels are available.</Typography> : <Box className="grid grid-cols-1 md:grid-cols-2 gap-2 overflow-auto" style={{ maxHeight }}>{visibleChannels.map((channel) => {
      if (typeof channel.database_id !== 'number') return null;
      return <FormControlLabel key={channel.database_id} control={<Checkbox checked={selectedIds.includes(channel.database_id)} onChange={(event) => update(channel.database_id as number, event.target.checked)} />} label={channelLabel(channel)} />;
    })}</Box>}
  </>;
};

export default ChannelGrantPicker;

