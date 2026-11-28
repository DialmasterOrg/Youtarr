const { DOWNLOAD_RESOLUTIONS, AUDIO_FORMATS } = require('../downloadOptions');

describe('constants/downloadOptions', () => {
  it('lists the resolutions a download may ask for', () => {
    expect(DOWNLOAD_RESOLUTIONS).toEqual(['360', '480', '720', '1080', '1440', '2160']);
  });

  it('lists the audio formats a download may ask for', () => {
    expect(AUDIO_FORMATS).toEqual(['video_mp3', 'mp3_only']);
  });

  it('cannot be changed by a module that imports the lists', () => {
    expect(Object.isFrozen(DOWNLOAD_RESOLUTIONS)).toBe(true);
    expect(Object.isFrozen(AUDIO_FORMATS)).toBe(true);
  });
});
