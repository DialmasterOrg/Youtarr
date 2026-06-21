export type RatingOption = {
  value: string;
  label: string;
  shortLabel: string;
};

export const RATING_OPTIONS: RatingOption[] = [
  { value: '', label: 'No limit', shortLabel: 'No limit' },
  { value: 'G', label: 'G — General Audiences', shortLabel: 'G' },
  { value: 'PG', label: 'PG — Parental Guidance', shortLabel: 'PG' },
  { value: 'PG-13', label: 'PG-13 — Parents Strongly Cautioned', shortLabel: 'PG-13' },
  { value: 'R', label: 'R — Restricted', shortLabel: 'R' },
  { value: 'NC-17', label: 'NC-17 — Adults Only', shortLabel: 'NC-17' },
  { value: 'TV-Y', label: 'TV-Y — Young Children', shortLabel: 'TV-Y' },
  { value: 'TV-Y7', label: 'TV-Y7 — Ages 7+', shortLabel: 'TV-Y7' },
  { value: 'TV-G', label: 'TV-G — General Audience', shortLabel: 'TV-G' },
  { value: 'TV-PG', label: 'TV-PG — Parental Guidance', shortLabel: 'TV-PG' },
  { value: 'TV-14', label: 'TV-14 — 14+', shortLabel: 'TV-14' },
  { value: 'TV-MA', label: 'TV-MA — Mature Audiences', shortLabel: 'TV-MA' },
  { value: 'NR', label: 'NR — Not Rated', shortLabel: 'NR' },
];
