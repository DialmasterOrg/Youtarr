export type RatingOption = {
  value: string;
  label: string;
};

export const RATING_OPTIONS: RatingOption[] = [
  { value: '', label: 'No limit' },
  { value: 'G', label: 'G — General Audiences' },
  { value: 'PG', label: 'PG — Parental Guidance' },
  { value: 'PG-13', label: 'PG-13 — Parents Strongly Cautioned' },
  { value: 'R', label: 'R — Restricted' },
  { value: 'NC-17', label: 'NC-17 — Adults Only' },
  { value: 'TV-Y', label: 'TV-Y — Young Children' },
  { value: 'TV-Y7', label: 'TV-Y7 — Ages 7+' },
  { value: 'TV-G', label: 'TV-G — General Audience' },
  { value: 'TV-PG', label: 'TV-PG — Parental Guidance' },
  { value: 'TV-14', label: 'TV-14 — 14+' },
  { value: 'TV-MA', label: 'TV-MA — Mature Audiences' },
  { value: 'NR', label: 'NR — Not Rated' },
];

const RATING_LIMITS: Record<string, number> = {
  'TV-Y': 0,
  'TV-Y7': 7,
  'TV-G': 0,
  'TV-PG': 7,
  'TV-14': 13,
  'TV-MA': 18,
  G: 0,
  PG: 7,
  'PG-13': 16,
  R: 18,
  'NC-17': 18,
};

export const getRatingLimit = (rating?: string | null): number | null => {
  if (!rating) return null;
  const normalized = rating.toUpperCase().trim();
  if (normalized === 'NR') return null;
  return RATING_LIMITS[normalized] ?? null;
};

export const isRatingAllowed = (rating: string | null | undefined, maxRating: string): boolean => {
  if (!maxRating) return true;
  const maxLimit = getRatingLimit(maxRating);
  if (maxLimit === null) return true;
  const ratingLimit = getRatingLimit(rating ?? null);
  return ratingLimit === null || ratingLimit <= maxLimit;
};
