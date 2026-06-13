import { getPublishedDateDisplay } from '../publishedDateDisplay';

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

describe('getPublishedDateDisplay', () => {
  it('returns the plain date for exact sources', () => {
    const result = getPublishedDateDisplay(
      { publishedAt: '2024-03-15T00:00:00.000Z', published_at_source: 'exact', media_type: 'video' },
      formatDate
    );
    expect(result).toBe('2024-03-15');
  });

  it('prefixes approximate dates with a tilde', () => {
    const result = getPublishedDateDisplay(
      { publishedAt: '2024-03-15T00:00:00.000Z', published_at_source: 'approximate', media_type: 'video' },
      formatDate
    );
    expect(result).toBe('~2024-03-15');
  });

  it('treats legacy rows without a source as approximate', () => {
    const result = getPublishedDateDisplay(
      { publishedAt: '2024-03-15T00:00:00.000Z', published_at_source: null, media_type: 'video' },
      formatDate
    );
    expect(result).toBe('~2024-03-15');
  });

  it('returns Pending for estimated rows', () => {
    const result = getPublishedDateDisplay(
      { publishedAt: null, published_at_source: 'estimated', media_type: 'video' },
      formatDate
    );
    expect(result).toBe('Pending');
  });

  it('returns null for shorts regardless of date', () => {
    const result = getPublishedDateDisplay(
      { publishedAt: '2024-03-15T00:00:00.000Z', published_at_source: 'exact', media_type: 'short' },
      formatDate
    );
    expect(result).toBeNull();
  });

  it('returns null when there is no date and no estimate', () => {
    const result = getPublishedDateDisplay(
      { publishedAt: null, published_at_source: null, media_type: 'video' },
      formatDate
    );
    expect(result).toBeNull();
  });
});
