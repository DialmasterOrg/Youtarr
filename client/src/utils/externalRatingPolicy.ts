export interface ExternalRatingBand {
  level: 1 | 2 | 3 | 4;
  label: string;
  movieRatings: string[];
  tvRatings: string[];
}

/**
 * Human-readable presentation of the server's shared rating levels.
 * The numeric value remains an internal API contract; administrators choose
 * using the familiar movie and TV ratings that the policy actually allows.
 */
export const EXTERNAL_RATING_BANDS: ExternalRatingBand[] = [
  {
    level: 1,
    label: 'General audiences',
    movieRatings: ['G'],
    tvRatings: ['TV-Y', 'TV-G'],
  },
  {
    level: 2,
    label: 'Parental guidance',
    movieRatings: ['PG'],
    tvRatings: ['TV-Y7', 'TV-PG'],
  },
  {
    level: 3,
    label: 'Teen',
    movieRatings: ['PG-13'],
    tvRatings: ['TV-14'],
  },
  {
    level: 4,
    label: 'Mature',
    movieRatings: ['R', 'NC-17'],
    tvRatings: ['TV-MA'],
  },
];

export const getExternalRatingBand = (level: number) =>
  EXTERNAL_RATING_BANDS.find((band) => band.level === level) ||
  EXTERNAL_RATING_BANDS[EXTERNAL_RATING_BANDS.length - 1];

export const formatExternalRatingBand = (level: number) => {
  const band = getExternalRatingBand(level);
  return `${band.label} · Movies ${band.movieRatings.join('/')} · TV ${band.tvRatings.join('/')}`;
};
