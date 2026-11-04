import { getLinkTemplateError } from '../notificationLinkTemplate';

const NOT_HTTP = 'Link template must be a full URL that starts with http:// or https://.';

describe('getLinkTemplateError', () => {
  test.each([undefined, null, '', '   '])('accepts an empty template (%p)', (template) => {
    expect(getLinkTemplateError(template)).toBeNull();
  });

  test.each([
    'https://youtarr.example.com/videos?video={youtubeId}',
    'http://192.168.1.10:3087/videos?video={youtubeId}',
    'https://www.youtube.com/watch?v={youtubeId}',
    'https://example.com/fixed-page',
  ])('accepts %s', (template) => {
    expect(getLinkTemplateError(template)).toBeNull();
  });

  test.each([
    'youtarr.example.com/{youtubeId}',
    'ftp://example.com/{youtubeId}',
    'javascript:alert(1)//{youtubeId}',
  ])('rejects %s because it is not an http or https URL', (template) => {
    expect(getLinkTemplateError(template)).toBe(NOT_HTTP);
  });

  test.each(['https://example.com/{id}', 'https://example.com/{youtubeId'])(
    'rejects %s because it uses another variable',
    (template) => {
      expect(getLinkTemplateError(template)).toBe('Link template can only use the variable {youtubeId}.');
    }
  );

  test('rejects a template over 500 characters', () => {
    expect(getLinkTemplateError(`https://example.com/${'a'.repeat(500)}`)).toBe(
      'Link template must have at most 500 characters.'
    );
  });
});
