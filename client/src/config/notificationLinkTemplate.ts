// Mirror of getLinkTemplateError in server/modules/notifications/utils.js. The
// server checks the value again when the setting is saved and when a
// notification is sent.
export const LINK_TEMPLATE_VARIABLE = '{youtubeId}';
const MAX_LINK_TEMPLATE_LENGTH = 500;
const SAMPLE_YOUTUBE_ID = 'dQw4w9WgXcQ';
const NOT_A_URL_ERROR = 'Link template must be a full URL that starts with http:// or https://.';

/**
 * Check the link template that adds a link to each video in notifications.
 * An empty template is valid: it turns the links off.
 * @returns An error message, or null when the template is valid
 */
export function getLinkTemplateError(template: string | undefined | null): string | null {
  const trimmed = (template ?? '').trim();
  if (trimmed === '') return null;
  if (trimmed.length > MAX_LINK_TEMPLATE_LENGTH) {
    return `Link template must have at most ${MAX_LINK_TEMPLATE_LENGTH} characters.`;
  }

  const sample = trimmed.split(LINK_TEMPLATE_VARIABLE).join(SAMPLE_YOUTUBE_ID);
  if (/[{}]/.test(sample)) {
    return `Link template can only use the variable ${LINK_TEMPLATE_VARIABLE}.`;
  }

  let url: URL;
  try {
    url = new URL(sample);
  } catch {
    return NOT_A_URL_ERROR;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return NOT_A_URL_ERROR;
  }

  return null;
}
