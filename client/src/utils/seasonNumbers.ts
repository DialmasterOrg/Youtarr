/**
 * Season numbers a video can be assigned to or a season name given for, the
 * server's rule (patternCompiler.isAssignableSeason): a title or fixed season
 * (0-199) or an upload year (1928-2500; Jellyfin reads 200-1927 and anything
 * above 2500 as no season).
 */

export const MAX_SEASON = 199;
export const MIN_YEAR_SEASON = 1928;
export const MAX_YEAR_SEASON = 2500;
export const SEASON_RANGE_TEXT = `0-${MAX_SEASON}, or a year ${MIN_YEAR_SEASON}-${MAX_YEAR_SEASON}`;

export function isAssignableSeason(season: number | null | undefined): boolean {
  if (typeof season !== 'number' || !Number.isInteger(season)) return false;
  return (season >= 0 && season <= MAX_SEASON) || (season >= MIN_YEAR_SEASON && season <= MAX_YEAR_SEASON);
}
