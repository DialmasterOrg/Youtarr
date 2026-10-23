import React from 'react';
import { Box, Button, IconButton, TextField, Typography } from '../../../ui';
import { Add, Delete } from '../../../../lib/icons';
import { isAssignableSeason, MAX_YEAR_SEASON, SEASON_RANGE_TEXT } from '../../../../utils/seasonNumbers';

export interface SeasonNameRow {
  season: string;
  name: string;
}

/** Rows to the API's season names, keeping named seasons with a valid number. */
export function rowsToSeasonNames(rows: SeasonNameRow[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name || !/^\d+$/.test(row.season.trim())) continue;
    names[Number(row.season.trim())] = name;
  }
  return names;
}

/** Why a named row can't be saved, or null (rows without a name are dropped). */
export function seasonRowProblem(row: SeasonNameRow, rows: SeasonNameRow[]): string | null {
  if (!row.name.trim()) return null;
  const text = row.season.trim();
  if (!/^\d+$/.test(text)) return 'A season number';
  const season = Number(text);
  if (!isAssignableSeason(season)) return SEASON_RANGE_TEXT;
  const named = rows.filter((other) => other.name.trim() && other.season.trim() !== '' && Number(other.season.trim()) === season);
  return named.length > 1 ? `Season ${season} is named twice` : null;
}

export function seasonNamesToRows(names: Record<string, string>): SeasonNameRow[] {
  return Object.entries(names)
    .map(([season, name]) => ({ season, name }))
    .sort((a, b) => Number(a.season) - Number(b.season));
}

interface SeasonNamesEditorProps {
  rows: SeasonNameRow[];
  onChange: (rows: SeasonNameRow[]) => void;
}

/** Names for a show's seasons (tvshow.nfo and season.nfo), e.g. season 2 "V-Force". */
function SeasonNamesEditor({ rows, onChange }: SeasonNamesEditorProps) {
  const update = (index: number, patch: Partial<SeasonNameRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const nextSeason = rows.reduce((max, row) => Math.max(max, Number(row.season) || 0), 0) + 1;

  return (
    <Box className="flex flex-col gap-2">
      <Typography variant="body2" className="font-semibold">Season names</Typography>
      {rows.map((row, index) => (
        // Rows have no identity beyond their position while being edited.
        // eslint-disable-next-line react/no-array-index-key
        <Box key={index} className="flex items-center gap-2">
          <TextField
            label="Season"
            type="number"
            size="small"
            className="w-[100px]"
            value={row.season}
            onChange={(event) => update(index, { season: event.target.value })}
            error={Boolean(seasonRowProblem(row, rows))}
            helperText={seasonRowProblem(row, rows) || undefined}
            inputProps={{ min: 0, max: MAX_YEAR_SEASON, 'aria-label': `Season number of row ${index + 1}` }}
          />
          <TextField
            label="Name"
            size="small"
            fullWidth
            value={row.name}
            onChange={(event) => update(index, { name: event.target.value })}
            inputProps={{ 'aria-label': `Name of season ${row.season || index + 1}` }}
          />
          <IconButton
            aria-label={`Remove the name of season ${row.season || index + 1}`}
            size="small"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Delete size={16} />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button
          variant="text"
          size="small"
          startIcon={<Add size={16} />}
          onClick={() => onChange([...rows, { season: String(nextSeason), name: '' }])}
        >
          Name a season
        </Button>
      </Box>
    </Box>
  );
}

export default SeasonNamesEditor;
