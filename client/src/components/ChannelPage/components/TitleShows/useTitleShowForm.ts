import { useEffect, useMemo, useState } from 'react';
import { TitlePatternDraft, TitleShow, TitleShowDraft } from '../../../../types/titleShows';
import { rowsToSeasonNames, SeasonNameRow, seasonNamesToRows, seasonRowProblem } from './SeasonNamesEditor';

export const EMPTY_PATTERN: TitlePatternDraft = {
  text: '', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title',
};

function toPatternDraft(pattern: TitlePatternDraft): TitlePatternDraft {
  const { text, kind, seasonSource, seasonFixed, episodeSource } = pattern;
  return { text, kind, seasonSource, seasonFixed: seasonSource === 'fixed' ? seasonFixed ?? null : null, episodeSource };
}

/**
 * A pattern being edited: the simple text it had before switching to regex
 * mode, and the regex a saved pattern had before switching to the simple
 * syntax, each for the way back.
 */
export type EditablePattern = TitlePatternDraft & { simpleText?: string; regexText?: string };

export interface TitleShowForm {
  name: string;
  folderName: string;
  libraryFolder: string;
  patterns: EditablePattern[];
  excludeText: string;
  seasonRows: SeasonNameRow[];
}

/** The editor's form for one title show, and the draft it saves. */
export function useTitleShowForm(open: boolean, show: TitleShow | null, defaultFolder: string) {
  const [form, setForm] = useState<TitleShowForm>(() => initialForm(show, defaultFolder));

  useEffect(() => {
    if (open) setForm(initialForm(show, defaultFolder));
  }, [open, show, defaultFolder]);

  const draft = useMemo<TitleShowDraft>(() => {
    const value: TitleShowDraft = {
      name: form.name.trim(),
      libraryFolder: form.libraryFolder,
      excludeTerms: form.excludeText.split('\n').map((term) => term.trim()).filter(Boolean),
      seasonNames: rowsToSeasonNames(form.seasonRows),
      patterns: form.patterns.map(toPatternDraft),
    };
    if (show) value.id = show.id;
    if (form.folderName.trim()) value.folderName = form.folderName.trim();
    return value;
  }, [form, show]);

  const valid = Boolean(form.name.trim()) && form.patterns.length > 0 && form.patterns.every((pattern) => pattern.text.trim())
    && form.seasonRows.every((row) => !seasonRowProblem(row, form.seasonRows));
  const update = (patch: Partial<TitleShowForm>) => setForm((current) => ({ ...current, ...patch }));

  return { form, update, draft, valid };
}

function initialForm(show: TitleShow | null, defaultFolder: string): TitleShowForm {
  if (!show) {
    return { name: '', folderName: '', libraryFolder: defaultFolder, patterns: [{ ...EMPTY_PATTERN }], excludeText: '', seasonRows: [] };
  }
  return {
    name: show.name,
    folderName: show.folderName,
    libraryFolder: show.libraryFolder,
    patterns: show.patterns.map(toPatternDraft),
    excludeText: show.excludeTerms.join('\n'),
    seasonRows: seasonNamesToRows(show.seasonNames),
  };
}

export default useTitleShowForm;
