/* eslint-env jest */

jest.mock('fs', () => {
  const mockActualFs = jest.requireActual('fs');
  return {
    ...mockActualFs,
    existsSync: jest.fn()
  };
});

jest.mock('../../../logger');

jest.mock('../../archiveModule', () => ({
  readCompleteListLines: jest.fn().mockReturnValue([]),
  getNewVideoUrlsSince: jest.fn().mockReturnValue([]),
  addVideoToArchive: jest.fn().mockResolvedValue(),
  removeVideoFromArchive: jest.fn().mockResolvedValue(true)
}));

const fs = require('fs');
const archiveModule = require('../../archiveModule');
const {
  getCountOfDownloadedVideos,
  getNewVideoUrls,
  resolveUrlsToProcess,
  partitionDownloadResults,
  reconcileArchive,
} = require('../downloadResultProcessor');

// Stand-in for YtdlpErrorTracker: only the failedVideos Map is read here
const makeErrorTracker = (failedEntries = []) => ({
  failedVideos: new Map(failedEntries)
});

describe('downloadResultProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    archiveModule.readCompleteListLines.mockReturnValue([]);
    archiveModule.getNewVideoUrlsSince.mockReturnValue([]);
    archiveModule.removeVideoFromArchive.mockResolvedValue(true);
  });

  describe('getCountOfDownloadedVideos', () => {
    it('should return count from archive module', () => {
      archiveModule.readCompleteListLines.mockReturnValue(['video1', 'video2', 'video3']);
      expect(getCountOfDownloadedVideos()).toBe(3);
    });

    it('should return 0 for empty archive', () => {
      archiveModule.readCompleteListLines.mockReturnValue([]);
      expect(getCountOfDownloadedVideos()).toBe(0);
    });
  });

  describe('getNewVideoUrls', () => {
    it('should return new video URLs from archive module', () => {
      const mockUrls = ['https://youtu.be/abc123', 'https://youtu.be/def456'];
      archiveModule.getNewVideoUrlsSince.mockReturnValue(mockUrls);

      const result = getNewVideoUrls(5);

      expect(archiveModule.getNewVideoUrlsSince).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockUrls);
    });
  });

  describe('resolveUrlsToProcess', () => {
    it('converts youtube.com watch URLs to youtu.be form for manual downloads', () => {
      const result = resolveUrlsToProcess(
        'Manually Added Urls',
        ['https://www.youtube.com/watch?v=abc123XYZ_d&t=5s'],
        0
      );
      expect(result).toEqual(['https://youtu.be/abc123XYZ_d']);
    });

    it('passes youtu.be URLs through unchanged', () => {
      const result = resolveUrlsToProcess(
        'Manually Added Urls',
        ['https://youtu.be/abc123XYZ_d'],
        0
      );
      expect(result).toEqual(['https://youtu.be/abc123XYZ_d']);
    });

    it('diffs the archive against the pre-run count for channel downloads', () => {
      const mockUrls = ['https://youtu.be/newvideo123'];
      archiveModule.getNewVideoUrlsSince.mockReturnValue(mockUrls);

      const result = resolveUrlsToProcess('Channel Downloads', null, 7);

      expect(archiveModule.getNewVideoUrlsSince).toHaveBeenCalledWith(7);
      expect(result).toEqual(mockUrls);
    });
  });

  describe('partitionDownloadResults', () => {
    it('splits videos into successful and failed based on file size', () => {
      const videoData = [
        { youtubeId: 'good1234567', youTubeVideoName: 'Good', youTubeChannelName: 'Chan', fileSize: '1000' },
        { youtubeId: 'bad12345678', youTubeVideoName: 'Bad', youTubeChannelName: 'Chan', fileSize: null }
      ];

      const { successfulVideos, failedVideosList } = partitionDownloadResults(
        videoData, makeErrorTracker(), []
      );

      expect(successfulVideos).toHaveLength(1);
      expect(successfulVideos[0].youtubeId).toBe('good1234567');
      expect(failedVideosList).toHaveLength(1);
      expect(failedVideosList[0]).toMatchObject({
        youtubeId: 'bad12345678',
        error: 'Media file not found or incomplete'
      });
    });

    it('treats fileSize of "0" or "null" string as failed', () => {
      const videoData = [
        { youtubeId: 'zero1234567', youTubeVideoName: 'Zero', youTubeChannelName: 'Chan', fileSize: '0' },
        { youtubeId: 'nullstr1234', youTubeVideoName: 'Null', youTubeChannelName: 'Chan', fileSize: 'null' }
      ];

      const { successfulVideos, failedVideosList } = partitionDownloadResults(
        videoData, makeErrorTracker(), []
      );

      expect(successfulVideos).toHaveLength(0);
      expect(failedVideosList).toHaveLength(2);
    });

    it('counts a video successful when only the audio file exists (mp3_only mode)', () => {
      const videoData = [
        { youtubeId: 'audio123456', youTubeVideoName: 'Audio', youTubeChannelName: 'Chan', fileSize: null, audioFileSize: '500' }
      ];

      const { successfulVideos, failedVideosList } = partitionDownloadResults(
        videoData, makeErrorTracker(), []
      );

      expect(successfulVideos).toHaveLength(1);
      expect(failedVideosList).toHaveLength(0);
    });

    it('marks explicitly-failed videos failed even when a file exists', () => {
      const videoData = [
        { youtubeId: 'marked12345', youTubeVideoName: 'Marked', youTubeChannelName: 'Chan', fileSize: '1000' }
      ];
      const errorTracker = makeErrorTracker([
        ['marked12345', { youtubeId: 'marked12345', error: 'Download error' }]
      ]);

      const { successfulVideos, failedVideosList } = partitionDownloadResults(
        videoData, errorTracker, []
      );

      expect(successfulVideos).toHaveLength(0);
      expect(failedVideosList[0]).toMatchObject({
        youtubeId: 'marked12345',
        error: 'Download error'
      });
    });

    it('appends failed videos that have no metadata with Unknown title and channel', () => {
      const errorTracker = makeErrorTracker([
        ['nodata12345', { youtubeId: 'nodata12345', error: 'This video is not available', url: 'https://youtu.be/nodata12345' }]
      ]);

      const { failedVideosList } = partitionDownloadResults([], errorTracker, []);

      expect(failedVideosList).toEqual([{
        youtubeId: 'nodata12345',
        title: 'Unknown',
        channel: 'Unknown',
        error: 'This video is not available',
        url: 'https://youtu.be/nodata12345'
      }]);
    });

    it('backfills URLs into the errorTracker failedVideos map from urlsToProcess', () => {
      const errorTracker = makeErrorTracker([
        ['url12345678', { youtubeId: 'url12345678', error: 'Failed to download' }]
      ]);

      partitionDownloadResults([], errorTracker, ['https://youtu.be/url12345678']);

      expect(errorTracker.failedVideos.get('url12345678').url).toBe('https://youtu.be/url12345678');
    });
  });

  describe('reconcileArchive', () => {
    it('removes explicitly failed videos from archive when allowRedownload is false', async () => {
      const errorTracker = makeErrorTracker([
        ['failed12345', { youtubeId: 'failed12345', error: 'Failed' }]
      ]);

      await reconcileArchive({
        allowRedownload: false,
        failedVideosList: [{ youtubeId: 'failed12345' }],
        videoData: [],
        errorTracker
      });

      expect(archiveModule.removeVideoFromArchive).toHaveBeenCalledWith('failed12345');
    });

    it('does not remove videos that were not explicitly failed (stat-only failures)', async () => {
      await reconcileArchive({
        allowRedownload: false,
        failedVideosList: [{ youtubeId: 'statonly123' }],
        videoData: [],
        errorTracker: makeErrorTracker()
      });

      expect(archiveModule.removeVideoFromArchive).not.toHaveBeenCalled();
    });

    it('does not remove failed videos when allowRedownload is true', async () => {
      const errorTracker = makeErrorTracker([
        ['failed12345', { youtubeId: 'failed12345', error: 'Failed' }]
      ]);

      await reconcileArchive({
        allowRedownload: true,
        failedVideosList: [{ youtubeId: 'failed12345' }],
        videoData: [],
        errorTracker
      });

      expect(archiveModule.removeVideoFromArchive).not.toHaveBeenCalled();
    });

    it('adds videos whose file exists to the archive when allowRedownload is true', async () => {
      fs.existsSync.mockReturnValue(true);

      await reconcileArchive({
        allowRedownload: true,
        failedVideosList: [],
        videoData: [{ youtubeId: 'redl1234567', filePath: '/output/video.mp4' }],
        errorTracker: makeErrorTracker()
      });

      expect(archiveModule.addVideoToArchive).toHaveBeenCalledWith('redl1234567');
    });

    it('skips archive update when the file does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await reconcileArchive({
        allowRedownload: true,
        failedVideosList: [],
        videoData: [{ youtubeId: 'gone1234567', filePath: '/output/missing.mp4' }],
        errorTracker: makeErrorTracker()
      });

      expect(archiveModule.addVideoToArchive).not.toHaveBeenCalled();
    });

    it('falls back to audioFilePath when filePath is not set', async () => {
      fs.existsSync.mockReturnValue(true);

      await reconcileArchive({
        allowRedownload: true,
        failedVideosList: [],
        videoData: [{ youtubeId: 'audio123456', audioFilePath: '/output/audio.mp3' }],
        errorTracker: makeErrorTracker()
      });

      expect(fs.existsSync).toHaveBeenCalledWith('/output/audio.mp3');
      expect(archiveModule.addVideoToArchive).toHaveBeenCalledWith('audio123456');
    });
  });
});
