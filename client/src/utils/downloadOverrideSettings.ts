import { DownloadSettings } from '../components/DownloadManager/ManualDownload/types';
import { DownloadOverrideSettings } from '../types/downloadOverrideSettings';

// What the download settings dialog returned, as the override settings a
// download request takes. The dialog returns null when the defaults apply.
export function toDownloadOverrideSettings(settings: DownloadSettings | null): DownloadOverrideSettings | undefined {
  if (!settings) return undefined;
  return {
    resolution: settings.resolution,
    allowRedownload: settings.allowRedownload,
    subfolder: settings.subfolder,
    audioFormat: settings.audioFormat,
    rating: settings.rating,
    skipVideoFolder: settings.skipVideoFolder,
    protect: settings.protect,
  };
}
