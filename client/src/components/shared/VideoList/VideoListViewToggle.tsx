import React from 'react';
import { Button } from '../../ui';
import {
  LayoutGrid as GridIcon,
  Rows as TableIcon,
  List as ListIcon,
} from '../../../lib/icons';
import { VideoListViewMode } from './types';

export interface VideoListViewToggleProps {
  value: VideoListViewMode;
  modes: VideoListViewMode[];
  onChange: (mode: VideoListViewMode) => void;
  size?: 'small' | 'medium';
}

const LABELS: Record<VideoListViewMode, string> = {
  grid: 'Grid View',
  list: 'List View',
  table: 'Table View',
};

function IconFor({ mode, size = 16 }: { mode: VideoListViewMode; size?: number }) {
  if (mode === 'grid') return <GridIcon size={size} />;
  if (mode === 'list') return <ListIcon size={size} />;
  return <TableIcon size={size} />;
}

function VideoListViewToggle({ value, modes, onChange, size = 'small' }: VideoListViewToggleProps) {
  return (
    <div
      className="flex shrink-0 self-center rounded-[var(--radius-ui)] overflow-hidden border border-border"
      style={{ height: size === 'small' ? 36 : 40 }}
    >
      {modes.map((mode) => {
        const isActive = value === mode;
        return (
          <Button
            key={mode}
            variant={isActive ? 'contained' : 'text'}
            size="small"
            onClick={() => onChange(mode)}
            title={LABELS[mode]}
            aria-label={LABELS[mode]}
            aria-pressed={isActive}
            className="rounded-none"
            style={{ minWidth: 40, height: '100%' }}
            data-testid={`view-mode-${mode}`}
          >
            <IconFor mode={mode} size={16} />
          </Button>
        );
      })}
    </div>
  );
}

export default VideoListViewToggle;
