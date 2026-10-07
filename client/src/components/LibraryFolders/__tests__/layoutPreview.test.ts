import { exampleFrom, previewRows, readsAs } from '../layoutPreview';

const stored = {
  channelName: 'Blippi', title: 'Fire Trucks', youtubeId: 'abcDEF12345',
  uploadedAt: '2026-09-28T15:30:00.000Z', uploadedAtSource: 'timestamp' as const,
  relativePath: 'Blippi/Blippi - Fire Trucks - abcDEF12345/Blippi - Fire Trucks [abcDEF12345].mp4',
};
const example = exampleFrom(stored);

describe('layoutPreview', () => {
  test('the current Videos layout uses the real path', () => {
    const rows = previewRows({ folderName: 'Kids', baseName: 'data', layout: 'videos', currentLayout: 'videos', example, flat: false });
    expect(rows.map((row) => `${row.prefix}${row.name}`)).toEqual([
      '__Kids/',
      '\u2514\u2500 Blippi/',
      '   \u251c\u2500 poster.jpg',
      '   \u2514\u2500 Blippi - Fire Trucks - abcDEF12345/',
      '      \u2514\u2500 Blippi - Fire Trucks [abcDEF12345].mp4',
    ]);
  });

  test('the TV preview computes the season and episode from the upload time in UTC', () => {
    const rows = previewRows({ folderName: '', baseName: 'data', layout: 'tv', currentLayout: 'videos', example, flat: false });
    expect(rows.map((row) => row.name)).toEqual([
      'data/', '.plexignore', 'Blippi/', 'tvshow.nfo, poster.jpg', 'Season 2026/', 'S2026E09281530 - Fire Trucks [abcDEF12345].mp4',
    ]);
    expect(readsAs('tv', example)).toBe('Shows up as the show Blippi, Season 2026, episode 09281530: uploaded Sep 28, 15:30 UTC.');
  });

  test('flat structure drops the per-video folder; an upload date reads as midnight', () => {
    const dated = exampleFrom({ ...stored, relativePath: '', uploadedAt: '2026-09-28T00:00:00.000Z', uploadedAtSource: 'upload_date' as const });
    const rows = previewRows({ folderName: 'Kids', baseName: 'data', layout: 'videos', currentLayout: 'tv', example: dated, flat: true });
    expect(rows.map((row) => row.name)).toEqual(['__Kids/', 'Blippi/', 'poster.jpg', 'Blippi - Fire Trucks [abcDEF12345].mp4']);
    expect(readsAs('tv', dated)).toBe('Shows up as the show Blippi, Season 2026, episode 09280000: uploaded Sep 28 (no time recorded, read as 00:00 UTC).');
  });

  test('falls back to the sample video without a download', () => {
    expect(exampleFrom(null)).toMatchObject({ channelName: 'Channel Name', title: 'Video Title', youtubeId: 'aBcD3fGh1jK', real: false });
  });
});
