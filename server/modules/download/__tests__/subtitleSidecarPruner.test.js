/* eslint-env jest */

const { selectSubtitleFilesToPrune } = require('../subtitleSidecarPruner');

const VIDEO_ID = 'Nyrha9Oo_GM';
const OTHER_VIDEO_ID = 'dQw4w9WgXcQ';

const srt = (code, id = VIDEO_ID) => `Some Title [${id}].${code}.srt`;

function prune({ files, uploaded = [], languages = 'en', id = VIDEO_ID, customArgs = '' }) {
  return selectSubtitleFilesToPrune({
    fileNames: files,
    youtubeId: id,
    uploadedCodes: uploaded,
    subtitleLanguage: languages,
    ytdlpCustomArgs: customArgs,
  });
}

describe('selectSubtitleFilesToPrune', () => {
  it('drops the auto track of a language once an uploaded track for it was written', () => {
    const files = [srt('en-GB'), srt('en'), `Some Title [${VIDEO_ID}].mp4`];
    expect(prune({ files, uploaded: ['en-GB'] })).toEqual([srt('en')]);
  });

  it('keeps every uploaded variant of the language', () => {
    const files = [srt('en-GB'), srt('en-US'), srt('en')];
    expect(prune({ files, uploaded: ['en-GB', 'en-US'] })).toEqual([srt('en')]);
  });

  it('keeps the bare auto track and drops auto variants when nothing was uploaded', () => {
    const files = [srt('pt'), srt('pt-PT')];
    expect(prune({ files, uploaded: [], languages: 'pt' })).toEqual([srt('pt-PT')]);
  });

  it('keeps all auto variants when nothing was uploaded and there is no bare track', () => {
    const files = [srt('zh-Hans'), srt('zh-Hant')];
    expect(prune({ files, uploaded: [], languages: 'zh' })).toEqual([]);
  });

  it('never drops a track the user selected by its exact code', () => {
    const files = [srt('en-GB'), srt('en'), srt('en-orig')];
    expect(prune({ files, uploaded: ['en-GB'], languages: 'en,en-orig' })).toEqual([srt('en')]);
  });

  it('only prunes languages that were configured as bare codes', () => {
    const files = [srt('en-GB'), srt('en'), srt('de-DE'), srt('de')];
    expect(prune({ files, uploaded: ['en-GB', 'de-DE'], languages: 'en' })).toEqual([srt('en')]);
  });

  it('prunes nothing for hand-edited patterns such as the "all" alias', () => {
    const files = [srt('en-GB'), srt('en')];
    expect(prune({ files, uploaded: ['en-GB'], languages: 'all' })).toEqual([]);
  });

  it.each(['en,all', 'en,en.*', 'en,-live_chat'])(
    'prunes nothing when any configured entry is an alias, regex or exclusion (%s)',
    (languages) => {
      const files = [srt('en-GB'), srt('en'), srt('en-orig')];
      expect(prune({ files, uploaded: ['en-GB'], languages })).toEqual([]);
    }
  );

  it.each([
    '--sub-langs pt-PT',
    '--sub-langs=pt-PT',
    '--srt-langs pt-PT',
    '--all-subs',
    // yt-dlp accepts any unique prefix of a long option
    '--sub-lang pt-PT',
    '--sub-l pt-PT',
    '--srt-lang pt-PT',
    '--all-sub',
    '--sub-lang=pt-PT',
  ])(
    'prunes nothing when the custom yt-dlp args choose subtitle languages (%s)',
    (customArgs) => {
      const files = [srt('pt'), srt('pt-PT')];
      expect(prune({ files, uploaded: [], languages: 'pt', customArgs })).toEqual([]);
    }
  );

  it('still prunes when the custom yt-dlp args only set the subtitle format', () => {
    const files = [srt('pt'), srt('pt-PT')];
    expect(prune({ files, uploaded: [], languages: 'pt', customArgs: '--sub-format srt' })).toEqual([srt('pt-PT')]);
  });

  it('prunes nothing when the custom yt-dlp args cannot be parsed', () => {
    const files = [srt('pt'), srt('pt-PT')];
    expect(prune({ files, uploaded: [], languages: 'pt', customArgs: '--sub-langs \'pt' })).toEqual([]);
  });

  it('still prunes when the custom yt-dlp args do not touch subtitles', () => {
    const files = [srt('pt'), srt('pt-PT')];
    expect(prune({ files, uploaded: [], languages: 'pt', customArgs: '--embed-metadata --retries 3' })).toEqual([srt('pt-PT')]);
  });

  it('counts an explicitly listed uploaded track when deciding to drop the auto one', () => {
    const files = [srt('en-GB'), srt('en')];
    expect(prune({ files, uploaded: ['en-GB'], languages: 'en,en-GB' })).toEqual([srt('en')]);
  });

  it('leaves other videos in a flat channel folder alone', () => {
    const files = [srt('en-GB'), srt('en'), srt('en', OTHER_VIDEO_ID), srt('en-GB', OTHER_VIDEO_ID)];
    expect(prune({ files, uploaded: ['en-GB'] })).toEqual([srt('en')]);
  });

  it('ignores files that are not .srt subtitles', () => {
    const files = [srt('en-GB'), `Some Title [${VIDEO_ID}].en.vtt`, `Some Title [${VIDEO_ID}].jpg`];
    expect(prune({ files, uploaded: ['en-GB'] })).toEqual([]);
  });

  it('compares language codes case-insensitively', () => {
    const files = [srt('en-GB'), srt('en')];
    expect(prune({ files, uploaded: ['EN-gb'] })).toEqual([srt('en')]);
  });

  it('prunes nothing when the uploaded codes are unknown', () => {
    const files = [srt('en-GB'), srt('en')];
    expect(selectSubtitleFilesToPrune({
      fileNames: files,
      youtubeId: VIDEO_ID,
      uploadedCodes: undefined,
      subtitleLanguage: 'en',
    })).toEqual([]);
  });

  it('prunes nothing without a video id', () => {
    const files = [srt('en-GB'), srt('en')];
    expect(prune({ files, uploaded: ['en-GB'], id: '' })).toEqual([]);
  });
});
