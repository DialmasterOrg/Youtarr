import React from 'react';
import { Typography } from '../ui';
import InfoPopoverButton from './InfoPopoverButton';
import { PLAYLIST_DOWNLOADED_NOTE, PLAYLIST_LIMIT_NOTE, PLAYLIST_TOTAL_NOTE } from '../../utils/playlistCounts';

const PlaylistCountsInfo: React.FC = () => (
  <InfoPopoverButton ariaLabel="Playlist video count info">
    <div className="flex flex-col gap-2">
      <Typography variant="body2">{PLAYLIST_DOWNLOADED_NOTE}</Typography>
      <Typography variant="body2">{PLAYLIST_TOTAL_NOTE}</Typography>
      <Typography variant="body2">{PLAYLIST_LIMIT_NOTE}</Typography>
    </div>
  </InfoPopoverButton>
);

export default PlaylistCountsInfo;
