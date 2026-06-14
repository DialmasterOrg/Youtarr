import { ChannelVideo } from '../../types/ChannelVideo';

/**
 * Format a video's published date for display, encoding provenance:
 * - exact (.info.json):                 plain date
 * - approximate / legacy (flat fetch):  "~" prefix; YouTube only reports
 *   relative times like "1 month ago", so the real date may differ by
 *   days or more
 * - estimated (date-less YouTube batch): "Pending" until a refresh or
 *   download fills the real date in
 * - shorts or no date at all:           null (caller hides or shows N/A)
 */
export function getPublishedDateDisplay(
  video: Pick<ChannelVideo, 'publishedAt' | 'published_at_source' | 'media_type'>,
  formatDate: (date: Date) => string
): string | null {
  if (video.media_type === 'short') {
    return null;
  }
  if (video.published_at_source === 'estimated') {
    return 'Pending';
  }
  if (!video.publishedAt) {
    return null;
  }
  const formatted = formatDate(new Date(video.publishedAt));
  return video.published_at_source === 'exact' ? formatted : `~${formatted}`;
}
