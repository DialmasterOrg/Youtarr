import React from 'react';
import { Chip, Stack } from '../../ui';

export type SubscriptionsFilterValue = 'all' | 'channels' | 'playlists';

interface SubscriptionsFilterProps {
  value: SubscriptionsFilterValue;
  onChange: (next: SubscriptionsFilterValue) => void;
  counts?: { channels?: number; playlists?: number };
}

function formatLabel(base: string, count?: number) {
  return typeof count === 'number' ? `${base} (${count})` : base;
}

const SubscriptionsFilter: React.FC<SubscriptionsFilterProps> = ({ value, onChange, counts }) => {
  return (
    <Stack
      direction="row"
      spacing={1}
      aria-label="Subscription type filter"
      role="group"
      className="my-2 flex-wrap gap-2"
    >
      <Chip
        label="All"
        color={value === 'all' ? 'primary' : 'default'}
        onClick={() => onChange('all')}
        aria-pressed={value === 'all'}
      />
      <Chip
        label={formatLabel('Channels', counts?.channels)}
        color={value === 'channels' ? 'primary' : 'default'}
        onClick={() => onChange('channels')}
        aria-pressed={value === 'channels'}
      />
      <Chip
        label={formatLabel('Playlists', counts?.playlists)}
        color={value === 'playlists' ? 'primary' : 'default'}
        onClick={() => onChange('playlists')}
        aria-pressed={value === 'playlists'}
      />
    </Stack>
  );
};

export default SubscriptionsFilter;
