import React, { ChangeEvent, KeyboardEvent, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Switch, TextField, Typography } from '../../../ui';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { MAX_MINIMUM_MINUTES, describeMatching } from '../../utils/arrBridgeSetup';
import { ArrBridgeNumberField } from './ArrBridgeNumberField';

const MAX_TERM_LENGTH = 60;
const MAX_TERMS = 100;

interface ArrBridgeMatchingSettingsProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  sonarrConnected: boolean;
  radarrConnected: boolean;
}

/**
 * How a YouTube video is matched to an episode or a movie. The rules combine,
 * so a plain-language summary above the controls says what the current
 * settings add up to.
 */
export const ArrBridgeMatchingSettings: React.FC<ArrBridgeMatchingSettingsProps> = ({
  config,
  onConfigChange,
  sonarrConnected,
  radarrConnected,
}) => {
  const [newTerm, setNewTerm] = useState('');
  const terms = config.arrBridgeExcludeTerms;
  const loose = config.arrBridgeLooseMatching;

  const summary = describeMatching({
    looseMatching: loose,
    minTvMinutes: config.arrBridgeMinTvMinutes,
    minMovieMinutes: config.arrBridgeMinMovieMinutes,
    excludeCount: terms.length,
    sonarrConnected,
    radarrConnected,
  });

  const cleanedTerm = newTerm.trim().toLowerCase();
  const canAddTerm = cleanedTerm.length > 0 && !terms.includes(cleanedTerm) && terms.length < MAX_TERMS;

  const addTerm = () => {
    if (!canAddTerm) return;
    onConfigChange({ arrBridgeExcludeTerms: [...terms, cleanedTerm] });
    setNewTerm('');
  };

  const handleTermKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addTerm();
  };

  return (
    <Box className="flex flex-col gap-4">
      <Box
        className="rounded-[var(--radius-ui)] border border-[var(--border)] bg-muted/30 p-3"
        role="group"
        aria-label="How a video is matched"
      >
        <Typography variant="subtitle2">How a video is matched</Typography>
        <ul className="m-0 mt-1 list-disc pl-5 text-sm">
          {summary.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      </Box>

      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={loose}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onConfigChange({ arrBridgeLooseMatching: event.target.checked })
              }
            />
          }
          label="Loose matching"
        />
        <Typography variant="body2" color="text.secondary">
          Also offers an episode number without a season and a movie without its year. It finds more, and it can
          offer the wrong video.
        </Typography>
        {loose && (
          <Alert severity="warning" className="mt-2">
            Loose matching can offer the wrong video. Turn off &quot;Enable Automatic Search&quot; for the Youtarr
            indexer in Sonarr and Radarr while this is on.
          </Alert>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2">Never offer videos with these words</Typography>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0" aria-label="Excluded words">
          {terms.map((term) => (
            <li
              key={term}
              className="inline-flex items-center gap-1 rounded-[var(--radius-ui)] border border-[var(--border)] bg-muted/40 py-0.5 pl-2 pr-1 text-sm"
            >
              {term}
              <button
                type="button"
                aria-label={`Remove ${term}`}
                className="cursor-pointer border-0 bg-transparent px-1 text-muted-foreground hover:text-foreground"
                onClick={() => onConfigChange({ arrBridgeExcludeTerms: terms.filter((entry) => entry !== term) })}
              >
                x
              </button>
            </li>
          ))}
        </ul>
        <Box className="mt-3 flex flex-wrap items-start gap-2">
          <TextField
            size="small"
            label="Add a word or phrase"
            value={newTerm}
            inputProps={{ maxLength: MAX_TERM_LENGTH }}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTerm(event.target.value)}
            onKeyDown={handleTermKeyDown}
          />
          <Button variant="outlined" disabled={!canAddTerm} onClick={addTerm}>
            Add word
          </Button>
          <Button onClick={() => onConfigChange({ arrBridgeExcludeTerms: [...DEFAULT_CONFIG.arrBridgeExcludeTerms] })}>
            Restore the default words
          </Button>
        </Box>
      </Box>

      <Box className="grid gap-4 md:grid-cols-2">
        <ArrBridgeNumberField
          label="Shortest episode (minutes)"
          value={config.arrBridgeMinTvMinutes}
          min={0}
          max={MAX_MINIMUM_MINUTES}
          onChange={(minutes) => onConfigChange({ arrBridgeMinTvMinutes: minutes })}
          helperText="Sonarr refuses to import an episode under 10 minutes for a series that runs over 30."
        />
        <ArrBridgeNumberField
          label="Shortest movie (minutes)"
          value={config.arrBridgeMinMovieMinutes}
          min={0}
          max={MAX_MINIMUM_MINUTES}
          onChange={(minutes) => onConfigChange({ arrBridgeMinMovieMinutes: minutes })}
          helperText="Keeps trailers and clips out. Radarr needs at least 10 minutes."
        />
      </Box>
    </Box>
  );
};

export default ArrBridgeMatchingSettings;
