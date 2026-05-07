/* eslint-disable testing-library/render-result-naming-convention */
// `renderTemplate` is a pure string-template renderer, not a React render helper.
import { renderTemplate, renderForPreview } from '../renderer';

const sample = {
  id: 'Cbq15X05wyY',
  title: 'ESCAPING 99 Nights in the Forest IN REAL LIFE!',
  uploader: 'Preston',
  channel: 'Preston',
  uploader_id: '@PrestonPlayz',
  channel_id: 'UCu6mSoMNzHQiBIOCkHUa2Aw',
  display_id: 'Cbq15X05wyY',
  upload_date: '20251017',
  ext: 'mp4',
} as const;

describe('renderTemplate - simple substitution', () => {
  it('substitutes %(field)s tokens', () => {
    const output = renderTemplate('%(title)s', sample);
    expect(output.rendered).toBe('ESCAPING 99 Nights in the Forest IN REAL LIFE! [Cbq15X05wyY].mp4');
  });

  it('substitutes multiple tokens with literal text in between', () => {
    const output = renderTemplate('%(uploader)s - %(title)s', sample);
    expect(output.rendered).toBe('Preston - ESCAPING 99 Nights in the Forest IN REAL LIFE! [Cbq15X05wyY].mp4');
  });

  it('always appends the locked suffix', () => {
    const output = renderTemplate('hello', sample);
    expect(output.rendered).toBe('hello [Cbq15X05wyY].mp4');
  });

  it('uses leading-space-free suffix when prefix is empty for defensive preview rendering', () => {
    const output = renderTemplate('', sample);
    expect(output.rendered).toBe('[Cbq15X05wyY].mp4');
  });

  it('returns the literal token when field is missing and lists it as unsupported', () => {
    const output = renderTemplate('%(nonexistent)s', sample);
    expect(output.rendered).toContain('%(nonexistent)s');
    expect(output.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('nonexistent'),
    ]));
  });
});

describe('renderTemplate - length', () => {
  it('reports rendered character length', () => {
    const output = renderTemplate('%(uploader)s', sample);
    // 'Preston [Cbq15X05wyY].mp4' = 25 chars
    expect(output.length).toBe(25);
  });
});

describe('renderTemplate - date formatting', () => {
  it('formats upload_date with %(field>strftime)s', () => {
    const output = renderTemplate('%(upload_date>%Y-%m-%d)s', sample);
    expect(output.rendered).toBe('2025-10-17 [Cbq15X05wyY].mp4');
  });

  it('handles underscore-separated date format', () => {
    const output = renderTemplate('%(upload_date>%Y_%m_%d)s', sample);
    expect(output.rendered).toBe('2025_10_17 [Cbq15X05wyY].mp4');
  });

  it('renders month name with %B', () => {
    const output = renderTemplate('%(upload_date>%B %Y)s', sample);
    expect(output.rendered).toBe('October 2025 [Cbq15X05wyY].mp4');
  });
});

describe('renderTemplate - truncation', () => {
  it('truncates with .NB byte limit', () => {
    const longTitle = { ...sample, title: 'A'.repeat(200) };
    const output = renderTemplate('%(title).76B', longTitle);
    expect(output.rendered.startsWith('A'.repeat(76))).toBe(true);
  });

  it('respects UTF-8 byte boundaries', () => {
    const emojiTitle = { ...sample, title: 'Hi! ' + '🎬'.repeat(20) }; // movie clapper emoji
    const output = renderTemplate('%(title).10B', emojiTitle);
    const stem = output.rendered.split(' [')[0];
    expect(new TextEncoder().encode(stem).length).toBeLessThanOrEqual(10);
  });

  it('truncates with .Ns char limit', () => {
    const longTitle = { ...sample, title: 'A'.repeat(200) };
    const output = renderTemplate('%(title).40s', longTitle);
    expect(output.rendered.startsWith('A'.repeat(40))).toBe(true);
  });
});

describe('renderTemplate - fallback chains', () => {
  it('uses comma-separated fallbacks', () => {
    const noUploader = { ...sample, uploader: '' };
    const output = renderTemplate('%(uploader,channel,uploader_id)s', noUploader);
    expect(output.rendered).toBe('Preston [Cbq15X05wyY].mp4');
  });

  it('falls through to uploader_id when uploader and channel are empty', () => {
    const onlyId = { ...sample, uploader: '', channel: '' };
    const output = renderTemplate('%(uploader,channel,uploader_id)s', onlyId);
    expect(output.rendered).toBe('@PrestonPlayz [Cbq15X05wyY].mp4');
  });

  it('uses |fallback when no field resolves', () => {
    const output = renderTemplate('%(nonexistent|N\\A)s', sample);
    expect(output.rendered).toBe('N\\A [Cbq15X05wyY].mp4');
  });
});

describe('renderTemplate - Windows sanitization', () => {
  it('replaces colons in titles', () => {
    const colonTitle = { ...sample, title: 'Q&A: Best Tools?' };
    const output = renderTemplate('%(title)s', colonTitle);
    expect(output.rendered).toBe('Q&A： Best Tools？ [Cbq15X05wyY].mp4');
  });
});

describe('renderTemplate - default prefix matches today\'s output', () => {
  it('produces the legacy filename when given the default prefix', () => {
    const output = renderTemplate('%(uploader,channel,uploader_id).80B - %(title).76B', sample);
    expect(output.rendered).toBe('Preston - ESCAPING 99 Nights in the Forest IN REAL LIFE! [Cbq15X05wyY].mp4');
  });
});

describe('renderForPreview', () => {
  it('returns both folder and file lines using the default prefix', () => {
    const result = renderForPreview(
      '%(uploader,channel,uploader_id).80B - %(title).76B',
      sample
    );
    expect(result.fileLine).toBe('Preston - ESCAPING 99 Nights in the Forest IN REAL LIFE! [Cbq15X05wyY].mp4');
    expect(result.folderLine).toBe('Preston - ESCAPING 99 Nights in the Forest IN REAL LIFE! - Cbq15X05wyY');
  });

  it('handles empty prefix defensively for both preview lines', () => {
    const result = renderForPreview('', sample);
    expect(result.fileLine).toBe('[Cbq15X05wyY].mp4');
    expect(result.folderLine).toBe('Cbq15X05wyY');
  });

  it('reports correct lengths', () => {
    const result = renderForPreview('%(title)s', sample);
    expect(result.fileLineLength).toBe(result.fileLine.length);
    expect(result.folderLineLength).toBe(result.folderLine.length);
  });

  it('shares warnings between folder and file (one substitution pass)', () => {
    const result = renderForPreview('%(nonexistent)s', sample);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('nonexistent'),
    ]));
  });
});
