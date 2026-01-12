/*{
  "title": "Five Nights at Freddy’s SCARY Truth…",
  "id": "WEywwDLeZE0",
  "publishedAt": "2023-06-10T14:15:05Z",
  "thumbnail": "https://i.ytimg.com/vi/WEywwDLeZE0/mqdefault.jpg",
  "added": false
},*/

export interface ChannelVideo {
  title: string;
  youtube_id: string;
  publishedAt: string | null | undefined;
  thumbnail: string;
  added: boolean;
  removed?: boolean;
  youtube_removed?: boolean;
  duration: number;
  availability?: string | null;
  fileSize?: number | null;
  media_type?: string | null;
  live_status?: string | null;
  ignored?: boolean;
  ignored_at?: string | null;
  normalized_rating?: string | null;
}
