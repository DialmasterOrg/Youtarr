const fs = require('fs');
const os = require('os');
const path = require('path');
const channelModule = require('../channelModule');
const ratingMapper = require('../ratingMapper');
const nfoGenerator = require('../nfoGenerator');

describe('End-to-end Ratings Flow', () => {
  it('parses yt-dlp metadata, maps rating, generates NFO, and updates on manual override', () => {
    // Setup temp directory and dummy video file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-e2e-'));
    const videoBaseName = 'Test Channel - Test Video [testid]';
    const videoPath = path.join(tmpDir, `${videoBaseName}.mp4`);
    fs.writeFileSync(videoPath, 'dummy video content');

    // Mock yt-dlp metadata entry
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

    // 1) Parse metadata and confirm mapping is applied
    const parsed = channelModule.parseVideoMetadata(entry);
    expect(parsed).toBeDefined();
    expect(parsed.content_rating).toBeDefined();
    expect(parsed.age_limit).toBe(18);
    expect(parsed.normalized_rating).toBe('R');
    expect(parsed.rating_source).toContain('mpaa');

    // 2) Simulate writing .info.json with mapped rating and generate NFO
    const jsonData = {
      id: parsed.youtubeId || parsed.youtube_id || entry.id,
      title: parsed.youTubeVideoName || parsed.title || entry.title,
      description: entry.description || '',
      uploader: entry.uploader,
      upload_date: entry.upload_date,
      duration: entry.duration,
      normalized_rating: parsed.normalized_rating,
      rating_source: parsed.rating_source,
      categories: entry.categories,
      tags: entry.tags
    };

    // Ensure NFO generation succeeds and contains rating
    const ok = nfoGenerator.writeVideoNfoFile(videoPath, jsonData);
    expect(ok).toBe(true);

    const nfoPath = path.join(tmpDir, `${videoBaseName}.nfo`);
    expect(fs.existsSync(nfoPath)).toBe(true);
    const content = fs.readFileSync(nfoPath, 'utf8');
    expect(content).toContain('<mpaa>R</mpaa>');
    expect(content).toContain('<ratings>');
    expect(content).toContain('mpaa');

    // 3) Simulate manual override (e.g., via Downloads UI) and regenerate NFO
    jsonData.normalized_rating = 'PG-13';
    jsonData.rating_source = 'Manual Override';

    const ok2 = nfoGenerator.writeVideoNfoFile(videoPath, jsonData);
    expect(ok2).toBe(true);

    const updated = fs.readFileSync(nfoPath, 'utf8');
    expect(updated).toContain('<mpaa>PG-13</mpaa>');
    expect(updated).toContain('Manual Override');

    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  });
});
