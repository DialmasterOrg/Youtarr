import isEqual from 'lodash/isEqual';

/**
 * Brings a server-side change to a list of keyed entries into an unsaved
 * draft of that list without losing the draft's own edits.
 *
 * `baseline` is the last saved list the draft was edited from and `saved` the
 * list the server holds now. Entries the server added or changed since the
 * baseline are put into the draft (replacing the draft's entry of that key),
 * entries the server removed are taken out, and everything else in the draft,
 * including pending additions, removals and edits of other keys, is kept.
 * Without a baseline the saved list is taken as is.
 */
export function mergeServerChange<T>(
  draft: T[],
  baseline: T[] | null | undefined,
  saved: T[],
  keyOf: (entry: T) => string
): T[] {
  if (!baseline) return saved;
  const baselineByKey = new Map(baseline.map((entry) => [keyOf(entry), entry]));
  const savedKeys = new Set(saved.map(keyOf));
  const changed = new Map(saved
    .filter((entry) => !isEqual(baselineByKey.get(keyOf(entry)), entry))
    .map((entry) => [keyOf(entry), entry]));
  const removed = new Set([...baselineByKey.keys()].filter((key) => !savedKeys.has(key)));

  const merged = draft
    .filter((entry) => !removed.has(keyOf(entry)))
    .map((entry) => changed.get(keyOf(entry)) ?? entry);
  const present = new Set(merged.map(keyOf));
  for (const [key, entry] of changed) {
    if (!present.has(key)) merged.push(entry);
  }
  return merged;
}
