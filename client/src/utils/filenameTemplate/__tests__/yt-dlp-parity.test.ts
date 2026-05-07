/* eslint-disable testing-library/render-result-naming-convention */
// `renderTemplate` is a pure string-template renderer, not a React render helper.
import { renderTemplate } from '../renderer';
import sampleData from '../sample-video.info.json';

const metadata = sampleData as Record<string, unknown>;

describe('renderer parity with recorded yt-dlp output', () => {
  const cases: { label: string; prefix: string; expected: string }[] = [
    {
      label: 'default',
      prefix: '%(uploader,channel,uploader_id).80B - %(title).76B',
      expected: 'TEDx Talks - How to Get Your Brain to Focus Even Better All The Time ｜ Chris Bailey ｜ TED [Hu4Yvq-g7_Y].webm',
    },
    {
      label: 'date prefix',
      prefix: '%(upload_date>%Y-%m-%d)s - %(title).76B',
      expected: '2019-04-05 - How to Get Your Brain to Focus Even Better All The Time ｜ Chris Bailey ｜ TED [Hu4Yvq-g7_Y].webm',
    },
    {
      label: 'plex youtube-agent',
      prefix: '%(upload_date>%Y_%m_%d)s %(title).76B',
      expected: '2019_04_05 How to Get Your Brain to Focus Even Better All The Time ｜ Chris Bailey ｜ TED [Hu4Yvq-g7_Y].webm',
    },
    {
      label: 'title only',
      prefix: '%(title).76B',
      expected: 'How to Get Your Brain to Focus Even Better All The Time ｜ Chris Bailey ｜ TED [Hu4Yvq-g7_Y].webm',
    },
    {
      label: 'empty prefix defensive rendering',
      prefix: '',
      expected: '[Hu4Yvq-g7_Y].webm',
    },
    {
      label: 'channel id',
      prefix: '%(channel)s [%(channel_id)s] %(title).50B',
      expected: 'TEDx Talks [UCsT0YIqwnpJCM-mx7-gSA4Q] How to Get Your Brain to Focus Even Better All The [Hu4Yvq-g7_Y].webm',
    },
    {
      label: 'month name',
      prefix: '%(upload_date>%B %Y)s - %(title).50B',
      expected: 'April 2019 - How to Get Your Brain to Focus Even Better All The [Hu4Yvq-g7_Y].webm',
    },
  ];

  cases.forEach(({ label, prefix, expected }) => {
    it(`matches recorded yt-dlp output for ${label}`, () => {
      const ours = renderTemplate(prefix, metadata);
      expect(ours.rendered).toBe(expected);
    });
  });
});
