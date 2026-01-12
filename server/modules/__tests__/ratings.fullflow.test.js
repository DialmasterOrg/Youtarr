const os = require('os');
const path = require('path');

// We'll mock heavy modules that cause side-effects (DB, scheduler, etc.)
jest.mock('../../logger');

let fs;
let ratingMapper;
let nfoGenerator;

describe('End-to-end Ratings Flow', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Provide a lightweight fs mock for the modules we exercise
    const realFs = jest.requireActual('fs');
    jest.doMock('fs', () => ({
      writeFileSync: jest.fn((p, d) => {}),
      readFileSync: jest.fn((p) => ''),
      existsSync: jest.fn(() => true),
      mkdtempSync: realFs.mkdtempSync,
      rmSync: jest.fn()
    }));

    // Re-require mocked fs and other modules after mocks
    fs = require('fs');
    ratingMapper = require('../ratingMapper');
    nfoGenerator = require('../nfoGenerator');
  });

  it('parses yt-dlp metadata, maps rating, generates NFO, and updates on manual override', () => {
    // Setup temp directory and dummy video file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-e2e-'));
    const videoBaseName = 'Test Channel - Test Video [testid]';
    const videoPath = path.join(tmpDir, `${videoBaseName}.mp4`);
    // writeFileSync is mocked; call it to simulate a file created
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

    // 1) Map rating using ratingMapper directly (avoid requiring channelModule side-effects)
    const mapped = ratingMapper.mapFromEntry(entry.contentRating || entry.content_rating, entry.age_limit);
    expect(mapped).toBeDefined();
    expect(mapped.normalized_rating).toBe('R');
    expect(mapped.source).toContain('mpaa');

    // 2) Simulate writing .info.json with mapped rating and generate NFO
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

    // Ensure NFO generation succeeds and contains rating
    const ok = nfoGenerator.writeVideoNfoFile(videoPath, jsonData);
    expect(ok).toBe(true);

    // fs.writeFileSync is mocked; inspect the mock call for NFO content
    expect(fs.writeFileSync).toHaveBeenCalled();
    // Find the most recent NFO write (contains '<movie>' tag)
    const nfoCall = [...fs.writeFileSync.mock.calls].reverse().find(c => typeof c[1] === 'string' && c[1].includes('<movie>'));
    expect(nfoCall).toBeDefined();
    const nfoContent = nfoCall[1];
    expect(nfoContent).toContain('<mpaa>R</mpaa>');
    expect(nfoContent).toContain('<ratings>');
    expect(nfoContent).toContain('mpaa');

    // 3) Simulate manual override (e.g., via Downloads UI) and regenerate NFO
    jsonData.normalized_rating = 'PG-13';
    jsonData.rating_source = 'Manual Override';

    const ok2 = nfoGenerator.writeVideoNfoFile(videoPath, jsonData);
    expect(ok2).toBe(true);

    // Second write should update NFO content
    // The second NFO write should also be present; pick the most recent NFO write now
    const updatedNfoCall = [...fs.writeFileSync.mock.calls].reverse().find(c => typeof c[1] === 'string' && c[1].includes('<movie>'));
    expect(updatedNfoCall).toBeDefined();
    const updated = updatedNfoCall[1];
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
