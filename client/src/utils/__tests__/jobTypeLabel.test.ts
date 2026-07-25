import { jobTypeLabel } from '../jobTypeLabel';

describe('jobTypeLabel', () => {
  test('maps plain manual downloads', () => {
    expect(jobTypeLabel('Manually Added Urls')).toBe('Manual download');
  });

  test('maps API-initiated manual downloads with the key name', () => {
    expect(jobTypeLabel('Manually Added Urls (via API: my-key)')).toBe('API: my-key');
  });

  test('maps plain channel downloads', () => {
    expect(jobTypeLabel('Channel Downloads')).toBe('Channel update');
  });

  test('maps grouped channel download variants', () => {
    expect(jobTypeLabel('Channel Downloads - 2 group(s)')).toBe('Channel update');
    expect(jobTypeLabel('Channel Downloads - Group 1/2 (1080p)')).toBe('Channel update');
    expect(jobTypeLabel('Channel Downloads - All Groups')).toBe('Channel update');
  });

  test('passes the channel-and-playlist run label through', () => {
    expect(jobTypeLabel('Channel & playlist update')).toBe('Channel & playlist update');
  });

  test('maps playlist download jobs with their title', () => {
    expect(jobTypeLabel('Playlist: My Mix')).toBe('Playlist download: My Mix');
  });

  test('maps the playlist run label and the synthetic sweep marker', () => {
    expect(jobTypeLabel('Playlist downloads')).toBe('Playlist downloads');
    expect(jobTypeLabel('Playlist Downloads')).toBe('Playlist downloads');
  });

  test('maps channel download-all jobs with their title', () => {
    expect(jobTypeLabel('Channel Download All: TechChannel')).toBe(
      'Full channel download: TechChannel'
    );
  });

  test('maps auto-retry jobs keeping the detail suffix', () => {
    expect(jobTypeLabel('Auto-retry: 3 videos (HTTP 403)')).toBe(
      'Automatic retry: 3 videos (HTTP 403)'
    );
  });

  test('passes the manual run label through', () => {
    expect(jobTypeLabel('Manual downloads')).toBe('Manual downloads');
  });

  test('returns unknown job types verbatim', () => {
    expect(jobTypeLabel('Import Subscriptions')).toBe('Import Subscriptions');
  });

  test('returns an empty string for missing job types', () => {
    expect(jobTypeLabel(undefined)).toBe('');
    expect(jobTypeLabel(null)).toBe('');
    expect(jobTypeLabel('')).toBe('');
  });
});
