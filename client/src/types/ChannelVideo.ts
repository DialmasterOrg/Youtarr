/*{
  "title": "Five Nights at Freddy’s SCARY Truth…",
  "id": "WEywwDLeZE0",
  "publishedAt": "2023-06-10T14:15:05Z",
  "thumbnail": "https://i.ytimg.com/vi/WEywwDLeZE0/mqdefault.jpg",
  "added": false
},*/

import type { RemovalReason } from '../utils/videoRemoval';

// Whether the configured cookies can open a members-only video (server:
// membersAccess). no_cookies and denied block downloading; unchecked videos
// are attempted and the download records the answer.
export type MembersAccessState = 'no_cookies' | 'unchecked' | 'confirmed' | 'denied';

export interface ChannelVideo {
  activity?: 'queued' | 'downloading';
  id?: number;
  title: string;
  youtube_id: string;
  publishedAt: string | null | undefined;
  // Provenance of publishedAt. The server blanks publishedAt for 'estimated'
  // rows (ordering-only placeholders), so UI date displays never see them.
  // Backend source of truth: server/modules/constants/publishedAtSource.js
  published_at_source?: 'exact' | 'approximate' | 'estimated' | null;
  thumbnail: string;
  added: boolean;
  removed?: boolean;
  // Why the file is gone (see utils/videoRemoval): 'not_found' = missing, anything else = deleted
  removed_reason?: RemovalReason | null;
  removed_at?: string | null;
  removed_detail?: string | null;
  // Listed in the download archive without a database record, so a download
  // skips it unless re-downloading is allowed. Never true for ignored videos.
  inArchive?: boolean;
  youtube_removed?: boolean;
  duration: number;
  availability?: string | null;
  // Set on members-only videos: whether the configured cookies can open them.
  members_access?: MembersAccessState | null;
  fileSize?: number | null;
  filePath?: string | null;
  audioFilePath?: string | null;
  audioFileSize?: number | null;
  media_type?: string | null;
  live_status?: string | null;
  ignored?: boolean;
  ignored_at?: string | null;
  normalized_rating?: string | null;
  rating_source?: string | null;
  protected?: boolean;
  timeCreated?: string | null;
  // Actual downloaded pixel dimensions, e.g. "1920x1080"; "0x0" = probe failed
  video_resolution?: string | null;
  watchedBy?: string[];
}
