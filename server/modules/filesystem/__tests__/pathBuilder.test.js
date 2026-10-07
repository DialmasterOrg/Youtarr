const {
  buildSubfolderSegment,
  isSubfolderDirectory,
  extractSubfolderName,
  resolveEffectiveSubfolder,
  resolveChannelFolderName,
  buildChannelPath,
  buildOutputTemplate,
  buildThumbnailTemplate,
  extractYoutubeIdFromPath,
  isFileForVideo,
  calculateRelocatedPath,
  extractSubfolderFromAbsPath
} = require('../pathBuilder');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('../constants');

describe('filesystem/pathBuilder', () => {
  describe('buildSubfolderSegment', () => {
    it('should add __ prefix to subfolder name', () => {
      expect(buildSubfolderSegment('MyFolder')).toBe('__MyFolder');
    });

    it('should trim whitespace', () => {
      expect(buildSubfolderSegment('  MyFolder  ')).toBe('__MyFolder');
    });

    it('should return null for null input', () => {
      expect(buildSubfolderSegment(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(buildSubfolderSegment('')).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      expect(buildSubfolderSegment('   ')).toBeNull();
    });
  });

  describe('isSubfolderDirectory', () => {
    it('should return true for directories starting with __', () => {
      expect(isSubfolderDirectory('__MyFolder')).toBe(true);
      expect(isSubfolderDirectory('__')).toBe(true);
    });

    it('should return false for regular directories', () => {
      expect(isSubfolderDirectory('MyFolder')).toBe(false);
      expect(isSubfolderDirectory('_MyFolder')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isSubfolderDirectory(null)).toBe(false);
      expect(isSubfolderDirectory(undefined)).toBe(false);
    });
  });

  describe('extractSubfolderName', () => {
    it('should extract name without prefix', () => {
      expect(extractSubfolderName('__MyFolder')).toBe('MyFolder');
    });

    it('should return null for non-subfolder directory', () => {
      expect(extractSubfolderName('MyFolder')).toBeNull();
    });

    it('should handle just the prefix', () => {
      expect(extractSubfolderName('__')).toBe('');
    });
  });

  describe('resolveEffectiveSubfolder', () => {
    it('should return null for ROOT_SENTINEL regardless of global default', () => {
      expect(resolveEffectiveSubfolder(ROOT_SENTINEL, 'default')).toBeNull();
      expect(resolveEffectiveSubfolder(ROOT_SENTINEL, null)).toBeNull();
    });

    it('should return global default for GLOBAL_DEFAULT_SENTINEL', () => {
      expect(resolveEffectiveSubfolder(GLOBAL_DEFAULT_SENTINEL, 'default')).toBe('default');
    });

    it('should return null for GLOBAL_DEFAULT_SENTINEL when no global default set', () => {
      expect(resolveEffectiveSubfolder(GLOBAL_DEFAULT_SENTINEL, null)).toBeNull();
    });

    it('should return channel subfolder when set', () => {
      expect(resolveEffectiveSubfolder('MyFolder', 'default')).toBe('MyFolder');
    });

    it('should trim channel subfolder', () => {
      expect(resolveEffectiveSubfolder('  MyFolder  ', 'default')).toBe('MyFolder');
    });

    it('should return null (root) when channel subfolder is null (backwards compatible)', () => {
      expect(resolveEffectiveSubfolder(null, 'default')).toBeNull();
    });

    it('should return null (root) when channel subfolder is empty (backwards compatible)', () => {
      expect(resolveEffectiveSubfolder('', 'default')).toBeNull();
    });

    it('should return null when both are null', () => {
      expect(resolveEffectiveSubfolder(null, null)).toBeNull();
    });
  });

  describe('resolveChannelFolderName', () => {
    it('should prefer folder_name over uploader', () => {
      const channel = { folder_name: 'SanitizedName', uploader: 'Original Name' };
      expect(resolveChannelFolderName(channel)).toBe('SanitizedName');
    });

    it('should fall back to uploader when folder_name is null', () => {
      const channel = { folder_name: null, uploader: 'Original Name' };
      expect(resolveChannelFolderName(channel)).toBe('Original Name');
    });

    it('should fall back to uploader when folder_name is undefined', () => {
      const channel = { uploader: 'Original Name' };
      expect(resolveChannelFolderName(channel)).toBe('Original Name');
    });
  });

  describe('buildChannelPath', () => {
    const baseDir = '/videos';

    it('should build path without subfolder', () => {
      expect(buildChannelPath(baseDir, null, 'ChannelName')).toBe('/videos/ChannelName');
    });

    it('should build path with subfolder', () => {
      expect(buildChannelPath(baseDir, 'MyFolder', 'ChannelName')).toBe('/videos/__MyFolder/ChannelName');
    });

    it('should handle empty subfolder as no subfolder', () => {
      expect(buildChannelPath(baseDir, '', 'ChannelName')).toBe('/videos/ChannelName');
    });

    it('should throw when a subfolder escapes the base directory', () => {
      // The __ prefix only absorbs one level; deeper traversal still escapes
      // path.join, so buildChannelPath must reject it.
      expect(() => buildChannelPath(baseDir, 'a/../../../etc', 'ChannelName')).toThrow(
        /escapes base directory/
      );
    });

    it('should not throw for a legitimate subfolder name', () => {
      expect(() => buildChannelPath(baseDir, 'My Folder-1', 'ChannelName')).not.toThrow();
    });
  });

  describe('buildOutputTemplate', () => {
    const baseDir = '/videos';

    it('should build template without subfolder', () => {
      const template = buildOutputTemplate(baseDir, null);
      expect(template).not.toContain('__');
      expect(template).toContain('%(uploader,channel,uploader_id).80B');
      expect(template).toContain('[%(id)s]');
    });

    it('should build template with subfolder', () => {
      const template = buildOutputTemplate(baseDir, 'MyFolder');
      expect(template).toContain('__MyFolder');
      expect(template).toContain('%(uploader,channel,uploader_id).80B');
    });

    it('uses provided videoFilenamePrefix when supplied', () => {
      const template = buildOutputTemplate(baseDir, null, '%(upload_date>%Y-%m-%d)s - %(title).76B');
      expect(template).toContain('%(upload_date>%Y-%m-%d)s - %(title).76B - %(id)s');
      expect(template).toContain('%(upload_date>%Y-%m-%d)s - %(title).76B [%(id)s].%(ext)s');
    });
  });

  describe('buildThumbnailTemplate', () => {
    const baseDir = '/videos';

    it('should build thumbnail template without subfolder', () => {
      const template = buildThumbnailTemplate(baseDir, null);
      expect(template).toContain('poster');
      expect(template).not.toContain('__');
    });

    it('should build thumbnail template with subfolder', () => {
      const template = buildThumbnailTemplate(baseDir, 'MyFolder');
      expect(template).toContain('__MyFolder');
      expect(template).toContain('poster');
    });

    it('uses provided videoFilenamePrefix for the folder name when supplied', () => {
      const template = buildThumbnailTemplate(baseDir, null, '%(upload_date>%Y-%m-%d)s - %(title).76B');
      expect(template).toContain('%(upload_date>%Y-%m-%d)s - %(title).76B - %(id)s');
      expect(template).toContain('poster');
    });
  });

  describe('extractYoutubeIdFromPath', () => {
    it('should extract ID from bracketed filename', () => {
      expect(extractYoutubeIdFromPath('/videos/Channel/Video [dQw4w9WgXcQ].mp4'))
        .toBe('dQw4w9WgXcQ');
    });

    it.each([
      ['Reference [aaaaaaaaaaa] [bbbbbbbbbbb].mp4', 'bbbbbbbbbbb'],
      ['Reference [aaaaaaaaaaa] [bbbbbbbbbbb].f137.mp4', 'bbbbbbbbbbb'],
      ['Reference [aaaaaaaaaaa] [bbbbbbbbbbb].en.vtt', 'bbbbbbbbbbb']
    ])('extracts the trailing ID, not one mentioned in the title, from %s', (fileName, expectedId) => {
      expect(extractYoutubeIdFromPath(`/videos/Channel/${fileName}`)).toBe(expectedId);
    });

    it('should extract ID from directory name', () => {
      expect(extractYoutubeIdFromPath('/videos/Channel/Video - Title - dQw4w9WgXcQ/poster.jpg'))
        .toBe('dQw4w9WgXcQ');
    });

    it('should return null when no ID found', () => {
      expect(extractYoutubeIdFromPath('/videos/Channel/poster.jpg')).toBeNull();
    });

    it('should handle empty path', () => {
      expect(extractYoutubeIdFromPath('')).toBeNull();
    });
  });

  describe('isFileForVideo', () => {
    const ID = 'aaaaaaaaaaa';

    it.each([
      'Channel - Title [aaaaaaaaaaa].mp4',
      'Channel - Title [aaaaaaaaaaa].mp3',
      'Channel - Title [aaaaaaaaaaa].jpg',
      'Channel - Title [aaaaaaaaaaa].nfo',
      'Channel - Title [aaaaaaaaaaa].en.srt',
      'Channel - Title [aaaaaaaaaaa].en-orig.srt',
      'Channel - Title [aaaaaaaaaaa]-fanart.jpg',
      'Channel - Title [aaaaaaaaaaa]-backdrop.jpg',
      'Channel - Title [aaaaaaaaaaa].f137.mp4.part',
      'Channel - Title [aaaaaaaaaaa].temp.mp4',
      '[aaaaaaaaaaa].mp4',
      '._Channel - Title [aaaaaaaaaaa].mp4',
      '._[aaaaaaaaaaa].mp4'
    ])('matches this video\'s file %s', (fileName) => {
      expect(isFileForVideo(fileName, ID)).toBe(true);
    });

    it.each([
      'Channel - Reference [aaaaaaaaaaa] [bbbbbbbbbbb].mp4',
      'Channel - Reference [aaaaaaaaaaa] [bbbbbbbbbbb].jpg',
      'Channel - Reference [aaaaaaaaaaa]-x [bbbbbbbbbbb].mp4',
      'Channel - talk - aaaaaaaaaaa rant [ccccccccccc].mp4',
      'Channel - Title - aaaaaaaaaaa.mp4',
      'Channel - Title [xaaaaaaaaaaa].mp4',
      'Channel - Title [aaaaaaaaaaax].mp4',
      'Channel - Title[aaaaaaaaaaa].mp4',
      'poster.jpg'
    ])('does not match other file %s', (fileName) => {
      expect(isFileForVideo(fileName, ID)).toBe(false);
    });

    it('treats regex characters in the ID literally', () => {
      expect(isFileForVideo('Title [a.a].mp4', 'a*a')).toBe(false);
    });

    it('returns false for a missing ID or file name', () => {
      expect(isFileForVideo('Title [aaaaaaaaaaa].mp4', '')).toBe(false);
      expect(isFileForVideo('', ID)).toBe(false);
    });
  });

  describe('calculateRelocatedPath', () => {
    it('should calculate new path after base change', () => {
      const oldBase = '/videos/Channel';
      const newBase = '/videos/__Subfolder/Channel';
      const original = '/videos/Channel/Video/file.mp4';
      expect(calculateRelocatedPath(oldBase, newBase, original))
        .toBe('/videos/__Subfolder/Channel/Video/file.mp4');
    });

    it('should return null if original does not start with oldBase', () => {
      expect(calculateRelocatedPath('/videos/A', '/videos/B', '/other/path')).toBeNull();
    });

    it('should return null for null original', () => {
      expect(calculateRelocatedPath('/a', '/b', null)).toBeNull();
    });
  });

  describe('extractSubfolderFromAbsPath', () => {
    const baseDir = '/usr/src/app/data';

    it('should return the subfolder name for a path inside a subfolder directory', () => {
      const filePath = '/usr/src/app/data/__Adults/The Daily Show/The Daily Show - Video - abc12345678/The Daily Show - Video [abc12345678].mp4';
      expect(extractSubfolderFromAbsPath(filePath, baseDir)).toBe('Adults');
    });

    it('should return null for a path directly under the base directory (root)', () => {
      const filePath = '/usr/src/app/data/ChannelName/ChannelName - Video - abc12345678/ChannelName - Video [abc12345678].mp4';
      expect(extractSubfolderFromAbsPath(filePath, baseDir)).toBeNull();
    });

    it('should handle subfolder names with spaces and special characters', () => {
      const filePath = '/usr/src/app/data/__Kids Shows/Channel/Video - id12345678/Video [id12345678].mp4';
      expect(extractSubfolderFromAbsPath(filePath, baseDir)).toBe('Kids Shows');
    });

    it('should work with audio (mp3) file paths', () => {
      const filePath = '/usr/src/app/data/__Podcasts/Channel/Video - id12345678/Video [id12345678].mp3';
      expect(extractSubfolderFromAbsPath(filePath, baseDir)).toBe('Podcasts');
    });

    it('should tolerate a trailing slash on the base directory', () => {
      const filePath = '/usr/src/app/data/__Adults/Channel/Video - id12345678/Video [id12345678].mp4';
      expect(extractSubfolderFromAbsPath(filePath, '/usr/src/app/data/')).toBe('Adults');
    });

    it('should return the subfolder for a flat-mode (skip_video_folder) layout with subfolder', () => {
      // Flat mode: no per-video directory - video file lives directly in the channel dir
      const filePath = '/usr/src/app/data/__Adults/Channel/Channel - Video [id12345678].mp4';
      expect(extractSubfolderFromAbsPath(filePath, baseDir)).toBe('Adults');
    });

    it('should return null for a flat-mode (skip_video_folder) layout without subfolder', () => {
      // Flat mode at root: channel dir directly under baseDir, file directly in channel dir
      const filePath = '/usr/src/app/data/Channel/Channel - Video [id12345678].mp4';
      expect(extractSubfolderFromAbsPath(filePath, baseDir)).toBeNull();
    });

    it('should return null when filePath is not under baseDir', () => {
      expect(extractSubfolderFromAbsPath('/other/path/video.mp4', baseDir)).toBeNull();
    });

    it('should return null for null filePath', () => {
      expect(extractSubfolderFromAbsPath(null, baseDir)).toBeNull();
    });

    it('should return null for undefined filePath', () => {
      expect(extractSubfolderFromAbsPath(undefined, baseDir)).toBeNull();
    });

    it('should return null for empty filePath', () => {
      expect(extractSubfolderFromAbsPath('', baseDir)).toBeNull();
    });

    it('should return null when baseDir is missing', () => {
      expect(extractSubfolderFromAbsPath('/usr/src/app/data/__Adults/Channel/file.mp4', null)).toBeNull();
    });

    it('should return empty string for a bare __ subfolder segment', () => {
      const filePath = '/usr/src/app/data/__/Channel/Video/Video [abc12345678].mp4';
      expect(extractSubfolderFromAbsPath(filePath, baseDir)).toBe('');
    });
  });
});
