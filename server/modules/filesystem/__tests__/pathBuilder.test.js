const {
  buildSubfolderSegment,
  isSubfolderDirectory,
  extractSubfolderName,
  resolveEffectiveSubfolder,
  resolveChannelFolderName,
  buildChannelPath,
  buildVideoPath,
  buildOutputTemplate,
  buildThumbnailTemplate,
  extractYoutubeIdFromPath,
  isValidYoutubeId,
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
  });

  describe('buildVideoPath', () => {
    const baseDir = '/videos';

    it('should build full video path without subfolder', () => {
      expect(buildVideoPath(baseDir, null, 'ChannelName', 'Video - Title - abc123'))
        .toBe('/videos/ChannelName/Video - Title - abc123');
    });

    it('should build full video path with subfolder', () => {
      expect(buildVideoPath(baseDir, 'MyFolder', 'ChannelName', 'Video - Title - abc123'))
        .toBe('/videos/__MyFolder/ChannelName/Video - Title - abc123');
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
  });

  describe('extractYoutubeIdFromPath', () => {
    it('should extract ID from bracketed filename', () => {
      expect(extractYoutubeIdFromPath('/videos/Channel/Video [dQw4w9WgXcQ].mp4'))
        .toBe('dQw4w9WgXcQ');
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

  describe('isValidYoutubeId', () => {
    it('should validate standard YouTube IDs', () => {
      expect(isValidYoutubeId('dQw4w9WgXcQ')).toBe(true);
    });

    it('should validate IDs with hyphens and underscores', () => {
      expect(isValidYoutubeId('a-b_c-d_e-fg')).toBe(true);
    });

    it('should reject too short', () => {
      expect(isValidYoutubeId('abc')).toBe(false);
    });

    it('should reject too long', () => {
      expect(isValidYoutubeId('abcdefghijklm')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidYoutubeId('abc!@#$%^&*')).toBe(false);
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
