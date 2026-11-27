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
  let Video;
  let JobVideo;
  let ChannelVideo;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    VideoMetadataProcessor = require('../download/videoMetadataProcessor');
    Job = require('../../models/job');
    Video = require('../../models/video');
    JobVideo = require('../../models/jobvideo');
    ChannelVideo = require('../../models/channelvideo');
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

    test('should handle invalid date formats', () => {
      expect(videoPersistence.uploadDateToIso(null)).toBeNull();
      expect(videoPersistence.uploadDateToIso('')).toBeNull();
      expect(videoPersistence.uploadDateToIso('invalid')).toBeNull();
      expect(videoPersistence.uploadDateToIso('2024')).toBeNull();
      expect(videoPersistence.uploadDateToIso(123)).toBeNull();
    });

    test('should handle invalid date values', () => {
      const result = videoPersistence.uploadDateToIso('20241345'); // Invalid month
      expect(result).toBeNull();
    });
  });

  describe('prepareVideoDataForSave', () => {
    test('sets last_downloaded_at and removed=false when the file is verified', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: '/videos/a.mp4',
        fileSize: '1000',
      }, true);

      expect(data).toEqual(expect.objectContaining({
        removed: false, removed_reason: null, removed_at: null, removed_detail: null,
      }));
      expect(data.last_downloaded_at).toBeInstanceOf(Date);
    });

    test('drops every removal column on update when nothing is verified', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: null,
        fileSize: null,
        removed: false,
        removed_reason: null,
        removed_at: null,
        removed_detail: null,
      }, false);

      expect(data).not.toHaveProperty('removed');
      expect(data).not.toHaveProperty('removed_reason');
      expect(data).not.toHaveProperty('removed_at');
      expect(data).not.toHaveProperty('removed_detail');
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

    test('drops video_resolution on update when no verified video file exists', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        audioFilePath: '/videos/a.mp3',
        audioFileSize: '500',
        video_resolution: null,
      }, false);

      expect(data).not.toHaveProperty('video_resolution');
    });

    test('keeps video_resolution when the video file is verified', () => {
      const data = videoPersistence.prepareVideoDataForSave({
        youtubeId: 'abc123',
        filePath: '/videos/a.mp4',
        fileSize: '1000',
        video_resolution: 1080,
      }, false);

      expect(data.video_resolution).toBe(1080);
    });
  });

  describe('upsertVideoForJob', () => {
    const video = {
      youtubeId: 'abc123',
      filePath: '/videos/a.mp4',
      fileSize: '1000',
    };

    test('links a newly created video to the job', async () => {
      Video.findOne.mockResolvedValue(null);
      Video.create.mockResolvedValue({ id: 7, youtubeId: 'abc123' });
      JobVideo.findOne.mockResolvedValue(null);

      await videoPersistence.upsertVideoForJob(video, { id: 'job1' });

      expect(JobVideo.create).toHaveBeenCalledWith({ job_id: 'job1', video_id: 7 });
    });

    test('does not link an existing video outside recovery', async () => {
      Video.findOne.mockResolvedValue({ id: 7, youtubeId: 'abc123', update: jest.fn() });

      await videoPersistence.upsertVideoForJob(video, { id: 'job1' });

      expect(JobVideo.create).not.toHaveBeenCalled();
    });

    // Both saves of a protected download rely on this: the per-video
    // post-processor, and the finalizer, by which time the row already exists.
    test('writes protection onto an existing row when the video data carries it', async () => {
      const update = jest.fn();
      Video.findOne.mockResolvedValue({ id: 7, youtubeId: 'abc123', update });

      await videoPersistence.upsertVideoForJob({ ...video, protected: true }, { id: 'job1' });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ protected: true }));
    });

    test('leaves protection alone on an existing row when the video data has none', async () => {
      const update = jest.fn();
      Video.findOne.mockResolvedValue({ id: 7, youtubeId: 'abc123', update });

      await videoPersistence.upsertVideoForJob(video, { id: 'job1' });

      expect(update.mock.calls[0][0]).not.toHaveProperty('protected');
    });

    test('links an existing video during recovery', async () => {
      Video.findOne.mockResolvedValue({ id: 7, youtubeId: 'abc123', update: jest.fn() });
      JobVideo.findOne.mockResolvedValue(null);

      await videoPersistence.upsertVideoForJob(video, { id: 'job1' }, true);

      expect(JobVideo.create).toHaveBeenCalledWith({ job_id: 'job1', video_id: 7 });
    });

    test('should create new video and JobVideo relationship when video does not exist', async () => {
      const videoData = {
        youtubeId: 'new-video-1',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'New Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345',
        removed: false
      };
      const jobInstance = { id: 'job-1' };

      Video.findOne.mockResolvedValue(null);
      const mockVideoInstance = { id: 'video-1', youtubeId: 'new-video-1' };
      Video.create.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await videoPersistence.upsertVideoForJob(videoData, jobInstance);

      expect(Video.create).toHaveBeenCalled();
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should update existing video and not create JobVideo when video exists and alwaysCreateJobVideo=false', async () => {
      const videoData = {
        youtubeId: 'existing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Existing Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'existing-video',
        update: jest.fn().mockResolvedValue()
      };
      Video.findOne.mockResolvedValue(mockVideoInstance);

      const result = await videoPersistence.upsertVideoForJob(videoData, jobInstance, false);

      expect(mockVideoInstance.update).toHaveBeenCalled();
      expect(Video.create).not.toHaveBeenCalled();
      expect(JobVideo.create).not.toHaveBeenCalled();
      expect(result).toBe(mockVideoInstance);
    });

    test('should update existing video and create JobVideo when alwaysCreateJobVideo=true', async () => {
      const videoData = {
        youtubeId: 'existing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Existing Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'existing-video',
        update: jest.fn().mockResolvedValue()
      };
      Video.findOne.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await videoPersistence.upsertVideoForJob(videoData, jobInstance, true);

      expect(mockVideoInstance.update).toHaveBeenCalled();
      expect(Video.create).not.toHaveBeenCalled();
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should not create duplicate JobVideo when relationship already exists', async () => {
      const videoData = {
        youtubeId: 'existing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Existing Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = {
        id: 'video-1',
        youtubeId: 'existing-video',
        update: jest.fn().mockResolvedValue()
      };
      const existingJobVideo = { job_id: 'job-1', video_id: 'video-1' };

      Video.findOne.mockResolvedValue(mockVideoInstance);
      JobVideo.findOne.mockResolvedValue(existingJobVideo);

      const result = await videoPersistence.upsertVideoForJob(videoData, jobInstance, true);

      expect(mockVideoInstance.update).toHaveBeenCalled();
      expect(JobVideo.create).not.toHaveBeenCalled();
      expect(result).toBe(mockVideoInstance);
    });

    test('should handle unique constraint error and fetch existing video', async () => {
      const videoData = {
        youtubeId: 'race-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Race Condition Video',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      // First findOne returns null (video doesn't exist yet)
      // Create fails with unique constraint error
      // Second findOne returns the video (created by another process)
      const mockVideoInstance = { id: 'video-1', youtubeId: 'race-video' };
      Video.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockVideoInstance);

      const uniqueError = new Error('Duplicate entry');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      Video.create.mockRejectedValue(uniqueError);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await videoPersistence.upsertVideoForJob(videoData, jobInstance, true);

      expect(Video.create).toHaveBeenCalled();
      expect(Video.findOne).toHaveBeenCalledTimes(2);
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-1'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should handle ER_DUP_ENTRY error and fetch existing video', async () => {
      const videoData = {
        youtubeId: 'race-video-2',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Race Condition Video 2',
        filePath: '/path/to/video.mp4',
        fileSize: '12345'
      };
      const jobInstance = { id: 'job-1' };

      const mockVideoInstance = { id: 'video-2', youtubeId: 'race-video-2' };
      Video.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockVideoInstance);

      const dupError = new Error('ER_DUP_ENTRY');
      dupError.original = { code: 'ER_DUP_ENTRY' };
      Video.create.mockRejectedValue(dupError);
      JobVideo.findOne.mockResolvedValue(null);

      const result = await videoPersistence.upsertVideoForJob(videoData, jobInstance, true);

      expect(Video.create).toHaveBeenCalled();
      expect(Video.findOne).toHaveBeenCalledTimes(2);
      expect(JobVideo.create).toHaveBeenCalledWith({
        job_id: 'job-1',
        video_id: 'video-2'
      });
      expect(result).toBe(mockVideoInstance);
    });

    test('should throw error if video not found after unique constraint error', async () => {
      const videoData = {
        youtubeId: 'missing-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Missing Video'
      };
      const jobInstance = { id: 'job-1' };

      Video.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const uniqueError = new Error('Duplicate entry');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      Video.create.mockRejectedValue(uniqueError);

      await expect(
        videoPersistence.upsertVideoForJob(videoData, jobInstance)
      ).rejects.toThrow('Failed to find video missing-video after unique constraint error');
    });

    test('should re-throw non-unique constraint errors', async () => {
      const videoData = {
        youtubeId: 'error-video',
        youTubeChannelName: 'Test Channel',
        youTubeVideoName: 'Error Video'
      };
      const jobInstance = { id: 'job-1' };

      Video.findOne.mockResolvedValue(null);

      const otherError = new Error('Database connection failed');
      Video.create.mockRejectedValue(otherError);

      await expect(
        videoPersistence.upsertVideoForJob(videoData, jobInstance)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('upsertChannelVideoFromInfo', () => {
    test('should create new channel video', async () => {
      const info = {
        id: 'video-1',
        channel_id: 'channel-1',
        title: 'Test Video',
        duration: 300,
        upload_date: '20240115',
        availability: 'public'
      };

      ChannelVideo.findOrCreate.mockResolvedValue([{}, true]);

      await videoPersistence.upsertChannelVideoFromInfo(info);

      expect(ChannelVideo.findOrCreate).toHaveBeenCalledWith({
        where: { youtube_id: 'video-1', channel_id: 'channel-1' },
        defaults: expect.objectContaining({
          title: 'Test Video',
          duration: 300,
          publishedAt: '2024-01-15T00:00:00.000Z',
          availability: 'public',
          thumbnail: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
          ignored: false,
          ignored_at: null
        })
      });
    });

    test('should update existing channel video', async () => {
      const mockRecord = { update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockRecord, false]);

      const info = {
        youtubeId: 'video-1',
        channelId: 'channel-1',
        youTubeVideoName: 'Updated Video',
        duration: 120,
        upload_date: '20240115',
        availability: 'public',
        media_type: 'video'
      };

      await videoPersistence.upsertChannelVideoFromInfo(info);

      // The non-date fields are updated directly (and ignored flags cleared)...
      expect(mockRecord.update).toHaveBeenCalledWith({
        title: 'Updated Video',
        thumbnail: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
        duration: 120,
        availability: 'public',
        media_type: 'video',
        ignored: false,
        ignored_at: null
      });
      // ...but the authoritative date is applied via the re-anchor module so the
      // row's old position is read first and neighbours stay ordered.
      const channelVideoReanchor = require('../channelVideoReanchor');
      expect(channelVideoReanchor.applyExactDateForGroup).toHaveBeenCalledWith({
        channelId: 'channel-1',
        mediaType: 'video',
        youtubeId: 'video-1',
        exactIso: '2024-01-15T00:00:00.000Z',
      });
      // The direct update must not carry the date fields.
      const updateCall = mockRecord.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('publishedAt');
      expect(updateCall).not.toHaveProperty('published_at_source');
    });

    test('should not touch publishedAt on update when info has no upload_date', async () => {
      const mockRecord = { update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockRecord, false]);

      await videoPersistence.upsertChannelVideoFromInfo({
        id: 'video-1',
        channel_id: 'channel-1',
        title: 'No Date Video'
      });

      const updateCall = mockRecord.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('publishedAt');
      expect(updateCall).not.toHaveProperty('published_at_source');
    });

    test('should skip update when skipUpdateIfExists is true', async () => {
      const mockRecord = { update: jest.fn() };
      ChannelVideo.findOrCreate.mockResolvedValue([mockRecord, false]);

      await videoPersistence.upsertChannelVideoFromInfo(
        { id: 'video-1', channel_id: 'channel-1' },
        { skipUpdateIfExists: true }
      );

      expect(mockRecord.update).not.toHaveBeenCalled();
    });

    test('should return early if missing required fields', async () => {
      await videoPersistence.upsertChannelVideoFromInfo({ id: 'video-1' });
      expect(ChannelVideo.findOrCreate).not.toHaveBeenCalled();

      await videoPersistence.upsertChannelVideoFromInfo({ channel_id: 'channel-1' });
      expect(ChannelVideo.findOrCreate).not.toHaveBeenCalled();
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

    test('saves the video as protected when the download was started with protection', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([metadata]);
      Job.findOne.mockResolvedValue({ id: 'job1' });
      const upsertVideoSpy = jest
        .spyOn(videoPersistence, 'upsertVideoForJob')
        .mockResolvedValue({ id: 7, youtubeId: 'abc123' });
      jest.spyOn(videoPersistence, 'upsertChannelVideoFromInfo').mockResolvedValue(undefined);

      await videoPersistence.persistDownloadedVideoForJob({ jobId: 'job1', youtubeId: 'abc123', protect: true });

      expect(upsertVideoSpy).toHaveBeenCalledWith({ ...metadata, protected: true }, { id: 'job1' });
    });

    test('links a re-downloaded existing video to the job', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([metadata]);
      Job.findOne.mockResolvedValue({ id: 'job2' });
      Video.findOne.mockResolvedValue({ id: 7, youtubeId: 'abc123', update: jest.fn() });
      JobVideo.findOne.mockResolvedValue(null);
      jest.spyOn(videoPersistence, 'upsertChannelVideoFromInfo').mockResolvedValue(undefined);

      await videoPersistence.persistDownloadedVideoForJob({ jobId: 'job2', youtubeId: 'abc123' });

      expect(JobVideo.create).toHaveBeenCalledWith({ job_id: 'job2', video_id: 7 });
    });

    test('does not duplicate an existing job link', async () => {
      VideoMetadataProcessor.processVideoMetadata.mockResolvedValue([metadata]);
      Job.findOne.mockResolvedValue({ id: 'job2' });
      Video.findOne.mockResolvedValue({ id: 7, youtubeId: 'abc123', update: jest.fn() });
      JobVideo.findOne.mockResolvedValue({ job_id: 'job2', video_id: 7 });
      jest.spyOn(videoPersistence, 'upsertChannelVideoFromInfo').mockResolvedValue(undefined);

      await videoPersistence.persistDownloadedVideoForJob({ jobId: 'job2', youtubeId: 'abc123' });

      expect(JobVideo.create).not.toHaveBeenCalled();
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
