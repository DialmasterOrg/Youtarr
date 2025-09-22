export interface Channel {
  url: string;
  uploader: string;
  channel_id?: string;
  description?: string;
  title?: string;
  id?: string; // YouTube channel ID
  db_id?: number; // Database ID for series profiles
}
