import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography } from '../../../ui';
import { ARR_DOCS_URL } from '../../utils/arrBridgeSetup';

const SUBTITLES_DOCS_URL = `${ARR_DOCS_URL}#subtitles`;
// Where the setting is in Sonarr and in Radarr.
const IMPORT_SETTING_PATH = 'Settings -> Media Management -> Importing';
const LINK_CLASS = 'text-primary underline';

// What the downloader uses when no language is saved.
const DEFAULT_SUBTITLE_LANGUAGE = 'en';

interface ArrBridgeSubtitlesNoteProps {
  /** The subtitlesEnabled setting: whether Youtarr downloads subtitles with a video. */
  subtitlesEnabled: boolean;
  /** The subtitleLanguage setting, a comma-separated list. A saved null reaches the page as it is. */
  subtitleLanguage: string | null;
}

const languageList = (subtitleLanguage: string | null) =>
  (subtitleLanguage ?? '').split(',').map((entry) => entry.trim()).filter(Boolean).join(', ')
  || DEFAULT_SUBTITLE_LANGUAGE;

/**
 * What it takes for Sonarr and Radarr to import a grab's subtitles: a grab
 * hands over the subtitle files a video has, which Youtarr downloads only
 * while subtitles are on, and the apps take them only with a setting that is
 * off by default in both.
 */
export const ArrBridgeSubtitlesNote: React.FC<ArrBridgeSubtitlesNoteProps> = ({
  subtitlesEnabled,
  subtitleLanguage,
}) => {
  const languages = languageList(subtitleLanguage);

  return (
    <Box role="group" aria-label="Subtitles">
      <Typography variant="subtitle2">Subtitles</Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitlesEnabled ? (
          <>
            Youtarr downloads subtitles ({languages}) with each video, and a grab hands over the subtitle files a
            video has. Sonarr and Radarr import them only with{' '}
          </>
        ) : (
          <>
            Subtitles are off in Youtarr, so a video downloaded now has none to hand over; one already in your
            library keeps the subtitles it has. Turn them on in{' '}
            <RouterLink to="/settings/core" className={LINK_CLASS}>
              Core settings
            </RouterLink>
            . Sonarr and Radarr then also need{' '}
          </>
        )}
        <strong>Import Extra Files</strong> on in each app: {IMPORT_SETTING_PATH}.{' '}
        <a href={SUBTITLES_DOCS_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          More about subtitles
        </a>
      </Typography>
    </Box>
  );
};

export default ArrBridgeSubtitlesNote;
