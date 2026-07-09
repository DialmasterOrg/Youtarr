import React from 'react';
import { ConfigState } from '../types';
import MediaServerPlaylistSection from './MediaServerPlaylistSection';

interface JellyfinSectionProps {
  config: ConfigState;
  token: string | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
}

export const JellyfinSection: React.FC<JellyfinSectionProps> = ({
  config,
  token,
  onConfigChange,
}) => (
  <MediaServerPlaylistSection
    kind="jellyfin"
    config={config}
    token={token}
    onConfigChange={onConfigChange}
  />
);

export default JellyfinSection;
