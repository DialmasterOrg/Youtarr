/* eslint-env jest */

const path = require('path');
const os = require('os');

jest.mock('fs', () => {
  const realFs = jest.requireActual('fs');
  return {
    ...realFs,
    writeFileSync: jest.fn(),
    mkdtempSync: realFs.mkdtempSync,
    rmSync: jest.fn()
  };
});

const fs = require('fs');
const ratingMapper = require('../ratingMapper');
const nfoGenerator = require('../nfoGenerator');

describe('ratings full flow', () => {
  it('maps rating and writes NFO with rating metadata', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-e2e-'));
    const videoBaseName = 'Test Channel - Test Video [testid]';
    const videoPath = path.join(tmpDir, `${videoBaseName}.mp4`);

    fs.writeFileSync(videoPath, 'dummy video content');

    const entry = {
      id: 'testid',
      title: 'Test Video',
      uploader: 'Test Channel',
      upload_date: '20240101',
      duration: 120,
      contentRating: { mpaaRating: 'mpaaR', tvpgRating: 'tvpg14' },
      age_limit: 18,
      tags: ['tag1'],
      categories: ['Comedy']
    };

    const mapped = ratingMapper.mapFromEntry(entry.contentRating, entry.age_limit);
    expect(mapped.normalized_rating).toBe('R');
    expect(mapped.source).toContain('mpaa');

    const jsonData = {
      id: entry.id,
      title: entry.title,
      description: entry.description || '',
      uploader: entry.uploader,
      upload_date: entry.upload_date,
      duration: entry.duration,
      normalized_rating: mapped.normalized_rating,
      rating_source: mapped.source,
      categories: entry.categories,
      tags: entry.tags
    };

    const ok = nfoGenerator.writeVideoNfoFile(videoPath, jsonData);
    expect(ok).toBe(true);

    const nfoCall = [...fs.writeFileSync.mock.calls].reverse().find(c => typeof c[1] === 'string' && c[1].includes('<movie>'));
    expect(nfoCall).toBeDefined();
    const nfoContent = nfoCall[1];
    expect(nfoContent).toContain('<mpaa>R</mpaa>');
    expect(nfoContent).toContain('<ratings>');
    expect(nfoContent).toContain('mpaa');

    jsonData.normalized_rating = 'PG-13';
    jsonData.rating_source = 'Manual Override';

    const ok2 = nfoGenerator.writeVideoNfoFile(videoPath, jsonData);
    expect(ok2).toBe(true);

    const updatedNfoCall = [...fs.writeFileSync.mock.calls].reverse().find(c => typeof c[1] === 'string' && c[1].includes('<movie>'));
    expect(updatedNfoCall).toBeDefined();
    const updated = updatedNfoCall[1];
    expect(updated).toContain('<mpaa>PG-13</mpaa>');
    expect(updated).toContain('Manual Override');

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  });
});
