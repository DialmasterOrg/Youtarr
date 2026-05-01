import React from 'react';
import { ConfigState } from '../types';
import MediaServerPlaylistSection from './MediaServerPlaylistSection';

interface EmbySectionProps {
  config: ConfigState;
  token: string | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
}

export const EmbySection: React.FC<EmbySectionProps> = ({
  config,
  token,
  onConfigChange,
}) => (
  <MediaServerPlaylistSection
    kind="emby"
    config={config}
    token={token}
    onConfigChange={onConfigChange}
  />
);

export default EmbySection;
