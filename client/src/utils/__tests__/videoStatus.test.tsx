import '@testing-library/jest-dom';
import {
  getVideoStatus,
  getStatusColor,
  getStatusIcon,
  getStatusLabel,
  getMediaTypeInfo,
  VideoStatus,
} from '../videoStatus';
import { ChannelVideo } from '../../types/ChannelVideo';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import LockIcon from '@mui/icons-material/Lock';
import BlockIcon from '@mui/icons-material/Block';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import ScheduleIcon from '@mui/icons-material/Schedule';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';

describe('videoStatus Utility', () => {
  // Base mock video for testing
  const baseMockVideo: ChannelVideo = {
    title: 'Test Video',
    youtube_id: 'test123',
    publishedAt: '2023-01-15T10:30:00Z',
    thumbnail: 'https://i.ytimg.com/vi/test123/mqdefault.jpg',
    added: false,
    duration: 600,
    media_type: 'video',
    live_status: null,
  };

  describe('getVideoStatus', () => {
    test('returns "ignored" when video is ignored', () => {
      const ignoredVideo = { ...baseMockVideo, ignored: true };
      expect(getVideoStatus(ignoredVideo)).toBe('ignored');
    });

    test('returns "ignored" for ignored video even if downloaded', () => {
      const ignoredDownloadedVideo = {
        ...baseMockVideo,
        ignored: true,
        added: true,
        removed: false,
      };
      expect(getVideoStatus(ignoredDownloadedVideo)).toBe('ignored');
    });

    test('returns "members_only" when availability is subscriber_only', () => {
      const membersOnlyVideo = {
        ...baseMockVideo,
        availability: 'subscriber_only',
      };
      expect(getVideoStatus(membersOnlyVideo)).toBe('members_only');
    });

    test('returns "members_only" even if video was previously downloaded', () => {
      const membersOnlyDownloadedVideo = {
        ...baseMockVideo,
        availability: 'subscriber_only',
        added: true,
        removed: false,
      };
      expect(getVideoStatus(membersOnlyDownloadedVideo)).toBe('members_only');
    });

    test('returns "never_downloaded" when video has not been added', () => {
      const neverDownloadedVideo = { ...baseMockVideo, added: false };
      expect(getVideoStatus(neverDownloadedVideo)).toBe('never_downloaded');
    });

    test('returns "never_downloaded" when added is false regardless of removed status', () => {
      const neverDownloadedVideo = {
        ...baseMockVideo,
        added: false,
        removed: true,
      };
      expect(getVideoStatus(neverDownloadedVideo)).toBe('never_downloaded');
    });

    test('returns "missing" when video was added but has been removed', () => {
      const missingVideo = {
        ...baseMockVideo,
        added: true,
        removed: true,
      };
      expect(getVideoStatus(missingVideo)).toBe('missing');
    });

    test('returns "downloaded" when video is added and not removed', () => {
      const downloadedVideo = {
        ...baseMockVideo,
        added: true,
        removed: false,
      };
      expect(getVideoStatus(downloadedVideo)).toBe('downloaded');
    });

    test('returns "downloaded" when video is added and removed is undefined', () => {
      const downloadedVideo = {
        ...baseMockVideo,
        added: true,
      };
      expect(getVideoStatus(downloadedVideo)).toBe('downloaded');
    });

    test('priority: ignored takes precedence over members_only', () => {
      const ignoredMembersOnlyVideo = {
        ...baseMockVideo,
        ignored: true,
        availability: 'subscriber_only',
      };
      expect(getVideoStatus(ignoredMembersOnlyVideo)).toBe('ignored');
    });

    test('priority: ignored takes precedence over downloaded', () => {
      const ignoredDownloadedVideo = {
        ...baseMockVideo,
        ignored: true,
        added: true,
        removed: false,
      };
      expect(getVideoStatus(ignoredDownloadedVideo)).toBe('ignored');
    });

    test('priority: members_only takes precedence over never_downloaded', () => {
      const membersOnlyNotDownloaded = {
        ...baseMockVideo,
        availability: 'subscriber_only',
        added: false,
      };
      expect(getVideoStatus(membersOnlyNotDownloaded)).toBe('members_only');
    });

    test('priority: members_only takes precedence over missing', () => {
      const membersOnlyMissing = {
        ...baseMockVideo,
        availability: 'subscriber_only',
        added: true,
        removed: true,
      };
      expect(getVideoStatus(membersOnlyMissing)).toBe('members_only');
    });
  });

  describe('getStatusColor', () => {
    test('returns "success" for downloaded status', () => {
      expect(getStatusColor('downloaded')).toBe('success');
    });

    test('returns "warning" for missing status', () => {
      expect(getStatusColor('missing')).toBe('warning');
    });

    test('returns "default" for members_only status', () => {
      expect(getStatusColor('members_only')).toBe('default');
    });

    test('returns "default" for ignored status', () => {
      expect(getStatusColor('ignored')).toBe('default');
    });

    test('returns "info" for never_downloaded status', () => {
      expect(getStatusColor('never_downloaded')).toBe('info');
    });

    test('returns "info" for unknown status', () => {
      expect(getStatusColor('unknown' as VideoStatus)).toBe('info');
    });
  });

  describe('getStatusIcon', () => {
    test('returns CheckCircleIcon for downloaded status', () => {
      const icon = getStatusIcon('downloaded');
      expect(icon.type).toBe(CheckCircleIcon);
      expect(icon.props.fontSize).toBe('small');
    });

    test('returns CloudOffIcon for missing status', () => {
      const icon = getStatusIcon('missing');
      expect(icon.type).toBe(CloudOffIcon);
      expect(icon.props.fontSize).toBe('small');
    });

    test('returns LockIcon for members_only status', () => {
      const icon = getStatusIcon('members_only');
      expect(icon.type).toBe(LockIcon);
      expect(icon.props.fontSize).toBe('small');
    });

    test('returns BlockIcon for ignored status', () => {
      const icon = getStatusIcon('ignored');
      expect(icon.type).toBe(BlockIcon);
      expect(icon.props.fontSize).toBe('small');
    });

    test('returns NewReleasesIcon for never_downloaded status', () => {
      const icon = getStatusIcon('never_downloaded');
      expect(icon.type).toBe(NewReleasesIcon);
      expect(icon.props.fontSize).toBe('small');
    });

    test('returns NewReleasesIcon for unknown status', () => {
      const icon = getStatusIcon('unknown' as VideoStatus);
      expect(icon.type).toBe(NewReleasesIcon);
      expect(icon.props.fontSize).toBe('small');
    });

    test('all icons have correct fontSize prop', () => {
      const statuses: VideoStatus[] = ['downloaded', 'missing', 'members_only', 'ignored', 'never_downloaded'];
      statuses.forEach(status => {
        const icon = getStatusIcon(status);
        expect(icon.props.fontSize).toBe('small');
      });
    });
  });

  describe('getStatusLabel', () => {
    test('returns "Downloaded" for downloaded status', () => {
      expect(getStatusLabel('downloaded')).toBe('Downloaded');
    });

    test('returns "Missing" for missing status', () => {
      expect(getStatusLabel('missing')).toBe('Missing');
    });

    test('returns "Members Only" for members_only status', () => {
      expect(getStatusLabel('members_only')).toBe('Members Only');
    });

    test('returns "Ignored" for ignored status', () => {
      expect(getStatusLabel('ignored')).toBe('Ignored');
    });

    test('returns "Not Downloaded" for never_downloaded status', () => {
      expect(getStatusLabel('never_downloaded')).toBe('Not Downloaded');
    });

    test('returns "Not Downloaded" for unknown status', () => {
      expect(getStatusLabel('unknown' as VideoStatus)).toBe('Not Downloaded');
    });
  });

  describe('getMediaTypeInfo', () => {
    test('returns correct info for short media type', () => {
      const info = getMediaTypeInfo('short');
      expect(info).not.toBeNull();
      expect(info?.label).toBe('Short');
      expect(info?.color).toBe('secondary');
      expect(info?.icon.type).toBe(ScheduleIcon);
      expect(info?.icon.props.fontSize).toBe('small');
    });

    test('returns correct info for livestream media type', () => {
      const info = getMediaTypeInfo('livestream');
      expect(info).not.toBeNull();
      expect(info?.label).toBe('Live');
      expect(info?.color).toBe('error');
      expect(info?.icon.type).toBe(VideoLibraryIcon);
      expect(info?.icon.props.fontSize).toBe('small');
    });

    test('returns null for video media type', () => {
      const info = getMediaTypeInfo('video');
      expect(info).toBeNull();
    });

    test('returns null for null media type', () => {
      const info = getMediaTypeInfo(null);
      expect(info).toBeNull();
    });

    test('returns null for undefined media type', () => {
      const info = getMediaTypeInfo(undefined);
      expect(info).toBeNull();
    });

    test('returns null for unknown media type', () => {
      const info = getMediaTypeInfo('unknown');
      expect(info).toBeNull();
    });

    test('short icon is ScheduleIcon', () => {
      const info = getMediaTypeInfo('short');
      expect(info?.icon.type).toBe(ScheduleIcon);
    });

    test('livestream icon is VideoLibraryIcon', () => {
      const info = getMediaTypeInfo('livestream');
      expect(info?.icon.type).toBe(VideoLibraryIcon);
    });
  });

  describe('Integration Tests', () => {
    test('ignored video returns correct color, icon, and label', () => {
      const ignoredVideo = { ...baseMockVideo, ignored: true };
      const status = getVideoStatus(ignoredVideo);

      expect(status).toBe('ignored');
      expect(getStatusColor(status)).toBe('default');
      expect(getStatusLabel(status)).toBe('Ignored');
      expect(getStatusIcon(status).type).toBe(BlockIcon);
      expect(getStatusIcon(status).props.fontSize).toBe('small');
    });

    test('downloaded video returns correct color, icon, and label', () => {
      const downloadedVideo = { ...baseMockVideo, added: true, removed: false };
      const status = getVideoStatus(downloadedVideo);

      expect(status).toBe('downloaded');
      expect(getStatusColor(status)).toBe('success');
      expect(getStatusLabel(status)).toBe('Downloaded');
      expect(getStatusIcon(status).type).toBe(CheckCircleIcon);
      expect(getStatusIcon(status).props.fontSize).toBe('small');
    });

    test('missing video returns correct color, icon, and label', () => {
      const missingVideo = { ...baseMockVideo, added: true, removed: true };
      const status = getVideoStatus(missingVideo);

      expect(status).toBe('missing');
      expect(getStatusColor(status)).toBe('warning');
      expect(getStatusLabel(status)).toBe('Missing');
      expect(getStatusIcon(status).type).toBe(CloudOffIcon);
      expect(getStatusIcon(status).props.fontSize).toBe('small');
    });

    test('members only video returns correct color, icon, and label', () => {
      const membersOnlyVideo = { ...baseMockVideo, availability: 'subscriber_only' };
      const status = getVideoStatus(membersOnlyVideo);

      expect(status).toBe('members_only');
      expect(getStatusColor(status)).toBe('default');
      expect(getStatusLabel(status)).toBe('Members Only');
      expect(getStatusIcon(status).type).toBe(LockIcon);
      expect(getStatusIcon(status).props.fontSize).toBe('small');
    });

    test('never downloaded video returns correct color, icon, and label', () => {
      const neverDownloadedVideo = { ...baseMockVideo, added: false };
      const status = getVideoStatus(neverDownloadedVideo);

      expect(status).toBe('never_downloaded');
      expect(getStatusColor(status)).toBe('info');
      expect(getStatusLabel(status)).toBe('Not Downloaded');
      expect(getStatusIcon(status).type).toBe(NewReleasesIcon);
      expect(getStatusIcon(status).props.fontSize).toBe('small');
    });

    test('short video returns correct media type info', () => {
      const shortVideo = { ...baseMockVideo, media_type: 'short' };
      const mediaInfo = getMediaTypeInfo(shortVideo.media_type);

      expect(mediaInfo).not.toBeNull();
      expect(mediaInfo?.label).toBe('Short');
      expect(mediaInfo?.color).toBe('secondary');
      expect(mediaInfo?.icon.type).toBe(ScheduleIcon);
      expect(mediaInfo?.icon.props.fontSize).toBe('small');
    });

    test('livestream video returns correct media type info', () => {
      const livestreamVideo = { ...baseMockVideo, media_type: 'livestream' };
      const mediaInfo = getMediaTypeInfo(livestreamVideo.media_type);

      expect(mediaInfo).not.toBeNull();
      expect(mediaInfo?.label).toBe('Live');
      expect(mediaInfo?.color).toBe('error');
      expect(mediaInfo?.icon.type).toBe(VideoLibraryIcon);
      expect(mediaInfo?.icon.props.fontSize).toBe('small');
    });

    test('regular video returns null media type info', () => {
      const regularVideo = { ...baseMockVideo, media_type: 'video' };
      const mediaInfo = getMediaTypeInfo(regularVideo.media_type);

      expect(mediaInfo).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('handles video with all optional fields undefined', () => {
      const minimalVideo: ChannelVideo = {
        title: 'Test',
        youtube_id: 'test',
        publishedAt: null,
        thumbnail: 'test.jpg',
        added: false,
        duration: 0,
      };

      const status = getVideoStatus(minimalVideo);
      expect(status).toBe('never_downloaded');
    });

    test('handles video with ignored set to false', () => {
      const notIgnoredVideo = { ...baseMockVideo, ignored: false };
      expect(getVideoStatus(notIgnoredVideo)).toBe('never_downloaded');
    });

    test('handles video with empty string availability', () => {
      const video = { ...baseMockVideo, availability: '' };
      expect(getVideoStatus(video)).toBe('never_downloaded');
    });

    test('handles video with different availability string', () => {
      const video = { ...baseMockVideo, availability: 'public' };
      expect(getVideoStatus(video)).toBe('never_downloaded');
    });

    test('handles video with null availability', () => {
      const video = { ...baseMockVideo, availability: null };
      expect(getVideoStatus(video)).toBe('never_downloaded');
    });
  });
});
