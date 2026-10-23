import React, { useId } from 'react';
import { Box, Button, FormControl, IconButton, InputLabel, MenuItem, Select, TextField } from '../../../ui';
import { ArrowDownward, ArrowUpward, Delete } from '../../../../lib/icons';
import { EpisodeSource, SeasonSource } from '../../../../types/titleShows';
import { EditablePattern } from './useTitleShowForm';

const SEASON_SOURCES: Array<{ value: SeasonSource; label: string }> = [
  { value: 'fixed', label: 'Fixed season' },
  { value: 'title', label: 'From the title ({season})' },
  { value: 'year', label: 'Upload year' },
];

const EPISODE_SOURCES: Array<{ value: EpisodeSource; label: string }> = [
  { value: 'title', label: 'From the title ({episode})' },
  { value: 'order', label: 'Next number in the season' },
  { value: 'date', label: 'Upload time (year seasons)' },
];

export interface PatternRowProps {
  index: number;
  count: number;
  pattern: EditablePattern;
  /** The pattern as the preview compiled it, only while the preview is for the current text */
  compiledRegex: string | null;
  onChange: (pattern: EditablePattern) => void;
  onRemove: () => void;
  /** Move to another position */
  onMove: (to: number) => void;
}

/** One title pattern of a show: its text, mode, and where season and episode numbers come from. */
function PatternRow({ index, count, pattern, compiledRegex, onChange, onRemove, onMove }: PatternRowProps) {
  const seasonLabelId = useId();
  const episodeLabelId = useId();
  const number = index + 1;
  const regex = pattern.kind === 'regex';

  // Regex mode starts from the compiled pattern; the way back restores the
  // simple text (regex text doesn't read as simple syntax). A regex that had
  // no simple text (a saved one) is kept while its text stands in for the
  // simple syntax, so it can be restored without a compiled preview.
  const switchMode = () => {
    if (regex) {
      onChange({
        ...pattern,
        kind: 'simple',
        text: pattern.simpleText ?? pattern.text,
        simpleText: undefined,
        regexText: pattern.simpleText ? undefined : pattern.text,
      });
    } else if (pattern.regexText) {
      onChange({ ...pattern, kind: 'regex', text: pattern.regexText, regexText: undefined });
    } else if (compiledRegex) {
      onChange({ ...pattern, kind: 'regex', text: compiledRegex, simpleText: pattern.text });
    }
  };
  const canSwitch = regex || Boolean(pattern.regexText) || Boolean(compiledRegex);
  const setText = (text: string) => onChange(regex ? { ...pattern, text } : { ...pattern, text, regexText: undefined });

  return (
    <Box className="flex flex-col gap-2 rounded-[var(--radius-ui)] border border-border p-3">
      <Box className="flex items-start gap-2">
        <TextField
          label={`Pattern ${number}`}
          size="small"
          fullWidth
          className={regex ? '[&_input]:font-mono' : undefined}
          value={pattern.text}
          onChange={(event) => setText(event.target.value)}
          inputProps={{ spellCheck: false }}
          helperText={regex ? 'Python regular expression with named groups season, episode and title' : undefined}
        />
        <IconButton aria-label={`Move pattern ${number} up`} size="small" disabled={index === 0} onClick={() => onMove(index - 1)}>
          <ArrowUpward size={16} />
        </IconButton>
        <IconButton aria-label={`Move pattern ${number} down`} size="small" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
          <ArrowDownward size={16} />
        </IconButton>
        <IconButton aria-label={`Remove pattern ${number}`} size="small" onClick={onRemove}>
          <Delete size={16} />
        </IconButton>
      </Box>
      <Box className="flex flex-wrap items-center gap-3">
        <FormControl className="min-w-[180px]">
          <InputLabel id={seasonLabelId} shrink>Season</InputLabel>
          <Select
            labelId={seasonLabelId}
            size="small"
            value={pattern.seasonSource}
            onChange={(event) => onChange({ ...pattern, seasonSource: event.target.value as SeasonSource })}
          >
            {SEASON_SOURCES.map((source) => <MenuItem key={source.value} value={source.value}>{source.label}</MenuItem>)}
          </Select>
        </FormControl>
        {pattern.seasonSource === 'fixed' && (
          <TextField
            label="Season number"
            type="number"
            size="small"
            className="w-[120px]"
            value={pattern.seasonFixed ?? ''}
            onChange={(event) => onChange({
              ...pattern, seasonFixed: event.target.value === '' ? null : Number(event.target.value),
            })}
            inputProps={{ min: 0, max: 199 }}
          />
        )}
        <FormControl className="min-w-[220px]">
          <InputLabel id={episodeLabelId} shrink>Episode</InputLabel>
          <Select
            labelId={episodeLabelId}
            size="small"
            value={pattern.episodeSource}
            onChange={(event) => onChange({ ...pattern, episodeSource: event.target.value as EpisodeSource })}
          >
            {EPISODE_SOURCES.map((source) => <MenuItem key={source.value} value={source.value}>{source.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="text" size="small" disabled={!canSwitch} onClick={switchMode}>
          {regex ? 'Use the simple syntax' : 'Edit as regular expression'}
        </Button>
      </Box>
    </Box>
  );
}

export default PatternRow;
