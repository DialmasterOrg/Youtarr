/* eslint-env jest */
const { planStagedSubtitles } = require('../stagedSubtitles');

const ID = 'abcdefghijk';
const TITLE = 'The.Office.US.S01E02.1080p.YT.WEB-DL-NBC';
const sidecar = (code) => `The Office - Diversity Day [${ID}].${code}.srt`;
const plan = (fileNames) => planStagedSubtitles({ fileNames, youtubeId: ID, releaseTitle: TITLE });

describe('planStagedSubtitles', () => {
  test('names a subtitle after the release with its language code', () => {
    const fileNames = [
      `The Office - Diversity Day [${ID}].mkv`,
      `The Office - Diversity Day [${ID}].jpg`,
      `The Office - Diversity Day [${ID}].nfo`,
      sidecar('en'),
    ];

    expect(plan(fileNames)).toEqual([{ sourceName: sidecar('en'), stagedName: `${TITLE}.en.srt`, language: 'en' }]);
  });

  // Sonarr and Radarr read only a 2 or 3 letter code at the end of the name:
  // "en-GB" would import with no language and "fr-CA" as Catalan.
  test.each([
    ['en-GB', 'en'],
    ['fr-CA', 'fr'],
    ['zh-Hans', 'zh'],
    ['es-419', 'es'],
    ['en-orig', 'en'],
    ['fil', 'fil'],
    ['PT-br', 'pt'],
  ])('shortens the track code %s to %s', (code, language) => {
    expect(plan([sidecar(code)])).toEqual([
      { sourceName: sidecar(code), stagedName: `${TITLE}.${language}.srt`, language },
    ]);
  });

  test('numbers the tracks of one language in the order of their codes', () => {
    expect(plan([sidecar('en-GB'), sidecar('en-CA')])).toEqual([
      { sourceName: sidecar('en-CA'), stagedName: `${TITLE}.1.en.srt`, language: 'en' },
      { sourceName: sidecar('en-GB'), stagedName: `${TITLE}.2.en.srt`, language: 'en' },
    ]);
  });

  test('puts the plain code first among the tracks of its language', () => {
    expect(plan([sidecar('zh-Hant'), sidecar('zh-Hans'), sidecar('zh')])).toEqual([
      { sourceName: sidecar('zh'), stagedName: `${TITLE}.1.zh.srt`, language: 'zh' },
      { sourceName: sidecar('zh-Hans'), stagedName: `${TITLE}.2.zh.srt`, language: 'zh' },
      { sourceName: sidecar('zh-Hant'), stagedName: `${TITLE}.3.zh.srt`, language: 'zh' },
    ]);
  });

  test('numbers only the languages that have several tracks', () => {
    expect(plan([sidecar('es'), sidecar('en-GB'), sidecar('en')])).toEqual([
      { sourceName: sidecar('en'), stagedName: `${TITLE}.1.en.srt`, language: 'en' },
      { sourceName: sidecar('en-GB'), stagedName: `${TITLE}.2.en.srt`, language: 'en' },
      { sourceName: sidecar('es'), stagedName: `${TITLE}.es.srt`, language: 'es' },
    ]);
  });

  test('leaves the subtitles of another video in a flat channel folder alone', () => {
    const fileNames = ['Another Episode [zzzzzzzzzzz].en.srt', sidecar('en')];

    expect(plan(fileNames)).toEqual([{ sourceName: sidecar('en'), stagedName: `${TITLE}.en.srt`, language: 'en' }]);
  });

  test.each([
    ['a macOS AppleDouble copy', `._${sidecar('en')}`],
    ['a subtitle that was not converted to srt', `The Office - Diversity Day [${ID}].en.vtt`],
    ['a code that is not a language code', sidecar('english')],
    ['a numeric code', sidecar('1234')],
  ])('skips %s', (_name, fileName) => {
    expect(plan([fileName])).toEqual([]);
  });

  test.each([
    ['no YouTube id', { fileNames: [sidecar('en')], youtubeId: null, releaseTitle: TITLE }],
    ['no file list', { fileNames: undefined, youtubeId: ID, releaseTitle: TITLE }],
  ])('plans nothing with %s', (_name, input) => {
    expect(planStagedSubtitles(input)).toEqual([]);
  });
});
