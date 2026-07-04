/* eslint-env jest */

jest.mock('../../models/job');
jest.mock('../../models/video');
jest.mock('../../models/jobvideo');
jest.mock('../../models/channelvideo');
jest.mock('../channelVideoReanchor', () => ({
  applyExactDateForGroup: jest.fn().mockResolvedValue(undefined),
  applyExactDateForVideo: jest.fn().mockResolvedValue(undefined),
}));
// Factory mock, not a bare automock: the automock loads the real module,
// which starts configModule's fs.watch and keeps Jest from exiting.
jest.mock('../download/videoMetadataProcessor', () => ({
  processVideoMetadata: jest.fn(),
}));
jest.mock('../../logger');

describe('videoPersistence', () => {
  let videoPersistence;
  let VideoMetadataProcessor;
  let Job;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    VideoMetadataProcessor = require('../download/videoMetadataProcessor');
    Job = require('../../models/job');
    videoPersistence = require('../videoPersistence');
  });

  describe('uploadDateToIso', () => {
    test('converts a YYYYMMDD upload_date to an ISO string', () => {
      expect(videoPersistence.uploadDateToIso('20240101')).toBe('2024-01-01T00:00:00.000Z');
    });

    test('returns null for an invalid or empty upload_date', () => {
      expect(videoPersistence.uploadDateToIso('')).toBeNull();
      expect(videoPersistence.uploadDateToIso(null)).toBeNull();
      expect(videoPersistence.uploadDateToIso('bad')).toBeNull();
    });
  });

  describe('prepareVideoDataForSave', () => {
    test('sets last_downloaded_at and removed=false when the file is verified', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: '/videos/a.mp4',
        fileSize: '1000',
      }, true);

      expect(data.removed).toBe(false);
      expect(data.last_downloaded_at).toBeInstanceOf(Date);
    });

    test('does not set last_downloaded_at when no file is verified', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: null,
        fileSize: null,
      }, true);

      expect(data.last_downloaded_at).toBeUndefined();
    });

    test('sets last_downloaded_at and removed=false for a verified audio-only download', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: null,
        fileSize: null,
        audioFilePath: '/videos/a.mp3',
        audioFileSize: '500',
      }, true);

      expect(data.removed).toBe(false);
      expect(data.last_downloaded_at).toBeInstanceOf(Date);
      expect(data.audioFilePath).toBe('/videos/a.mp3');
    });

    test('does not overwrite existing file fields of the other format on update', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: '/videos/a.mp4',
        fileSize: '1000',
        audioFilePath: null,
        audioFileSize: null,
      }, false);

      expect(data.filePath).toBe('/videos/a.mp4');
      expect(data.audioFilePath).toBeUndefined();
      expect(data.audioFileSize).toBeUndefined();
    });

    test('leaves all file fields untouched on update when nothing is verified', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: null,
        fileSize: null,
        audioFilePath: null,
        audioFileSize: null,
      }, false);

      expect(data.filePath).toBeUndefined();
      expect(data.fileSize).toBeUndefined();
      expect(data.audioFilePath).toBeUndefined();
      expect(data.audioFileSize).toBeUndefined();
      expect(data.removed).toBeUndefined();
      expect(data.last_downloaded_at).toBeUndefined();
    });
  });

  describe('persistDownloadedVideoForJob', () => {
    const metadata = {
      youtubeId: 'abc123',
      youTubeChannelName: 'Test Channel',
      youTubeVideoName: 'Test Video',
      duration: 300,
      originalDate: '20240101',
      channel_id: 'chan1',
      media_type: 'video',
      filePath: '/videos/Test Channel/Test Video [abc123].mp4',
      fileSize: '1000',
      audioFilePath: null,
      audioFileSize: null,
    };

    test('persists the video and channel video for a completed download', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([metadata]);
      Job.findOne.mockResolvedValue({ id: 'job1' });
      const upsertVideoSpy = jest
        .spyOn(videoPersistence, 'upsertVideoForJob')
        .mockResolvedValue({ id: 7, youtubeId: 'abc123' });
      const upsertChannelSpy = jest
        .spyOn(videoPersistence, 'upsertChannelVideoFromInfo')
        .mockResolvedValue(undefined);

      const result = await videoPersistence.persistDownloadedVideoForJob({
        jobId: 'job1',
        youtubeId: 'abc123',
      });

      expect(VideoMetadataProcessor.processVideoMetadata).toHaveBeenCalledWith(['youtu.be/abc123']);
      expect(upsertVideoSpy).toHaveBeenCalledWith(metadata, { id: 'job1' });
      expect(upsertChannelSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'abc123',
          title: 'Test Video',
          duration: 300,
          upload_date: '20240101',
          channel_id: 'chan1',
          media_type: 'video',
        })
      );
      expect(result).toEqual({ id: 7, youtubeId: 'abc123' });
    });

    test('persists audio-only downloads (audioFilePath set, filePath null)', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { ...metadata, filePath: null, fileSize: null, audioFilePath: '/a.mp3', audioFileSize: '500' },
      ]);
      Job.findOne.mockResolvedValue({ id: 'job1' });
      const upsertVideoSpy = jest
        .spyOn(videoPersistence, 'upsertVideoForJob')
        .mockResolvedValue({ id: 8 });
      jest.spyOn(videoPersistence, 'upsertChannelVideoFromInfo').mockResolvedValue(undefined);

      const result = await videoPersistence.persistDownloadedVideoForJob({
        jobId: 'job1',
        youtubeId: 'abc123',
      });

      expect(upsertVideoSpy).toHaveBeenCalled();
      expect(result).toEqual({ id: 8 });
    });

    test('returns null without touching the DB when jobId is missing', async () => {
      const upsertVideoSpy = jest.spyOn(videoPersistence, 'upsertVideoForJob');

      const result = await videoPersistence.persistDownloadedVideoForJob({
        jobId: null,
        youtubeId: 'abc123',
      });

      expect(result).toBeNull();
      expect(VideoMetadataProcessor.processVideoMetadata).not.toHaveBeenCalled();
      expect(upsertVideoSpy).not.toHaveBeenCalled();
    });

    test('returns null without creating an empty row when no file path was resolved', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([
        { ...metadata, filePath: null, audioFilePath: null },
      ]);
      const upsertVideoSpy = jest.spyOn(videoPersistence, 'upsertVideoForJob');

      const result = await videoPersistence.persistDownloadedVideoForJob({
        jobId: 'job1',
        youtubeId: 'abc123',
      });

      expect(result).toBeNull();
      expect(upsertVideoSpy).not.toHaveBeenCalled();
    });

    test('returns null when the job no longer exists', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([metadata]);
      Job.findOne.mockResolvedValue(null);
      const upsertVideoSpy = jest.spyOn(videoPersistence, 'upsertVideoForJob');

      const result = await videoPersistence.persistDownloadedVideoForJob({
        jobId: 'missing',
        youtubeId: 'abc123',
      });

      expect(result).toBeNull();
      expect(upsertVideoSpy).not.toHaveBeenCalled();
    });

    test('still returns the video when the channel video upsert fails', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([metadata]);
      Job.findOne.mockResolvedValue({ id: 'job1' });
      jest.spyOn(videoPersistence, 'upsertVideoForJob').mockResolvedValue({ id: 9 });
      jest
        .spyOn(videoPersistence, 'upsertChannelVideoFromInfo')
        .mockRejectedValue(new Error('cv fail'));

      const result = await videoPersistence.persistDownloadedVideoForJob({
        jobId: 'job1',
        youtubeId: 'abc123',
      });

      expect(result).toEqual({ id: 9 });
    });
  });
});
