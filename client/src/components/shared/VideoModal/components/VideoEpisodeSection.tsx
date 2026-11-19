import React, { useState } from 'react';
import { Box, Button, Typography } from '../../../ui';
import { VideoEpisode } from '../../../../types/titleShows';
import { useVideoEpisode } from '../../EpisodeAssign/useVideoEpisode';
import EpisodeAssignDialog from '../../EpisodeAssign/EpisodeAssignDialog';

function episodeText(classification: VideoEpisode['classification']): string {
  if (!classification) return 'Not in a show';
  if (classification.notAnEpisode) return 'Not an episode';
  if (classification.status === 'duplicate') return `Duplicate in ${classification.showName}`;
  if (classification.status === 'pending_number') return `${classification.showName}, numbered when it downloads`;
  if (classification.status === 'unsupported') return `${classification.showName} (not supported yet)`;
  return classification.code ? `${classification.code} of ${classification.showName}` : `${classification.showName}`;
}

interface VideoEpisodeSectionProps {
  open: boolean;
  token: string | null;
  youtubeId: string;
  title: string;
  /** Called after a save, so the page can reload its planned episode chips. */
  onChanged?: (youtubeId: string) => void;
}

/** The video's title show episode, and the way to change it by hand. Hidden for channels without title shows. */
function VideoEpisodeSection({ open, token, youtubeId, title, onChanged }: VideoEpisodeSectionProps) {
  const { data, refetch } = useVideoEpisode(open ? youtubeId : null, token);
  const [assigning, setAssigning] = useState(false);
  if (!data || !data.assignable) return null;

  return (
    <Box className="flex flex-wrap items-center gap-2">
      <Typography variant="body2" className="font-semibold">Episode</Typography>
      <Typography variant="body2" color="text.secondary" className="flex-1">{episodeText(data.classification)}</Typography>
      <Button size="small" variant="outlined" onClick={() => setAssigning(true)}>Change episode...</Button>
      <EpisodeAssignDialog
        open={assigning}
        token={token}
        youtubeId={youtubeId}
        videoTitle={title}
        onClose={() => setAssigning(false)}
        onSaved={() => { void refetch(); onChanged?.(youtubeId); }}
      />
    </Box>
  );
}

export default VideoEpisodeSection;
