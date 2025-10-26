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
}
