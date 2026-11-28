// The per-request overrides the download endpoints take as `overrideSettings`.
export interface DownloadOverrideSettings {
  resolution?: string;
  allowRedownload?: boolean;
  subfolder?: string | null;
  audioFormat?: string | null;
  rating?: string | null;
  skipVideoFolder?: boolean;
  // Protect the downloaded videos from automatic removal.
  protect?: boolean;
}
