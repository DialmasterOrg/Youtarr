export interface Channel {
  url: string;
  uploader: string;
  channel_id?: string;
  description?: string;
  title?: string;
  auto_download_enabled_tabs?: string;
  available_tabs?: string | null;
  sub_folder?: string | null;
  video_quality?: string | null;
  min_duration?: number | null;
  max_duration?: number | null;
  title_filter_regex?: string | null;
  default_rating?: string | null;
  audio_format?: string | null;
}
