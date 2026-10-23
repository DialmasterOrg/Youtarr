import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { LIBRARY_FOLDERS_PATH } from '../../../utils/libraryLayouts';
import { Chip, MenuItem, Select, SelectChangeEvent, Switch } from '../../ui';
import { Film, Info } from '../../../lib/icons';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { cn } from '../../../lib/cn';
import SubtitleLanguageSelector from '../SubtitleLanguageSelector';
import { SettingsSection } from '../common/SettingsSection';
import { SettingRow, settingDescriptionId } from '../common/SettingRow';
import { SettingNote } from '../common/SettingNote';
import { LibraryFoldersCard } from './components/LibraryFoldersCard';
import { FlatStructureDialog } from './components/FlatStructureDialog';
import { ScheduleSummary } from './components/ScheduleSummary';
import { VideoFilenameTemplate } from './components/VideoFilenameTemplate';
import { getChannelFilesOptions } from '../helpers';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../types';

interface CoreSettingsSectionProps {
  config: ConfigState;
  deploymentEnvironment: DeploymentEnvironment;
  isPlatformManaged: PlatformManagedState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  token: string | null;
  filenameTemplateSaveRequirement?: string | null;
  onFilenameTemplatePreviewSuccess?: (prefix: string) => void;
}

type BooleanConfigKey = { [K in keyof ConfigState]: ConfigState[K] extends boolean ? K : never }[keyof ConfigState];

const PHONE_QUERY = '(max-width: 767px)';
const RESOLUTIONS = [['2160', '4K (2160p)'], ['1440', '1440p'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p']];
const CODECS = [['default', 'Default (no preference)'], ['h264', 'H.264/AVC (best compatibility)'], ['h265', 'H.265/HEVC (balanced)']];
const MEDIA_FILES: Array<{ key: 'writeVideoNfoFiles' | 'writeChannelPosters' | 'writeVideoFanart' | 'writeBackdropImages'; label: string; description: string }> = [
  { key: 'writeVideoNfoFiles', label: 'Video .nfo files', description: 'Metadata for Kodi, Jellyfin and Emby. Episodes in TV shows folders always get one.' },
  { key: 'writeChannelPosters', label: 'Channel poster.jpg', description: 'Copies the channel thumbnail into each channel folder.' },
  { key: 'writeVideoFanart', label: 'Video fanart', description: 'A -fanart.jpg per video. Some Plex clients (NVIDIA Shield) use it as the background.' },
  { key: 'writeBackdropImages', label: 'Backdrop images', description: 'A backdrop.jpg in video and channel folders, for Jellyfin and Emby.' },
];
const NAMING_TV_NOTE = 'TV shows folders always use Season folders, SxxEyy file names and plain episode titles.';

/** Settings > Core: downloads, media server files, naming, interface, advanced (Core spec). */
export const CoreSettingsSection: React.FC<CoreSettingsSectionProps> = ({
  config, deploymentEnvironment, isPlatformManaged, onConfigChange, onMobileTooltipClick, token,
  filenameTemplateSaveRequirement, onFilenameTemplatePreviewSuccess,
}) => {
  const { hash } = useLocation();
  const phone = useMediaQuery(PHONE_QUERY);
  const [pendingFlat, setPendingFlat] = useState<boolean | null>(null);
  const elfhosted = deploymentEnvironment.platform?.toLowerCase() === 'elfhosted';

  useEffect(() => {
    const id = hash.slice(1);
    if (!id) return;
    document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
  }, [hash]);

  const toggle = (key: BooleanConfigKey) => (event: React.ChangeEvent<HTMLInputElement>) => onConfigChange({ [key]: event.target.checked });
  const switchFor = (key: BooleanConfigKey, extra: Partial<React.ComponentProps<typeof Switch>> = {}) => (
    <Switch id={key} name={key} checked={config[key]} onChange={toggle(key)} aria-describedby={settingDescriptionId(key)} {...extra} />
  );
  const describedBy = (controlId: string) => ({ 'aria-describedby': settingDescriptionId(controlId) });

  return (
    <div className="flex flex-col">
      <p className="text-sm text-muted-foreground">How Youtarr downloads videos, and the files it writes next to them.</p>
      <div className="mt-6 flex flex-col gap-8 lg:gap-12">
        <LibraryFoldersCard token={token} config={config} isPlatformManaged={isPlatformManaged}
          deploymentEnvironment={deploymentEnvironment} onMobileTooltipClick={onMobileTooltipClick} />

        <SettingsSection id="downloads" title="Downloads" description="What Youtarr downloads, and when.">
          <SettingRow controlId="channelAutoDownload" label="Automatic downloads"
            description="Check enabled channel tabs and auto-download playlists for new videos on a schedule."
            control={switchFor('channelAutoDownload')}>
            <ScheduleSummary scheduleKey="channelDownloadFrequency" value={config.channelDownloadFrequency} />
            {!config.channelAutoDownload && <p className="mt-1 text-[13px] text-muted-foreground">The schedule is idle until you turn this on.</p>}
          </SettingRow>
          <SettingRow controlId="channelFilesToDownload" label="Videos per channel tab and playlist" controlSize="select-compact"
            description="Newest uploads per channel tab, latest additions per playlist. Videos you already have are skipped."
            control={(
              <Select id="channelFilesToDownload" size="small" inputProps={describedBy('channelFilesToDownload')}
                value={config.channelFilesToDownload}
                onChange={(event: SelectChangeEvent<string>) => onConfigChange({ channelFilesToDownload: Number(event.target.value) })}>
                {getChannelFilesOptions(config.channelFilesToDownload).map((count) => (
                  <MenuItem key={count} value={count}>{count} {count === 1 ? 'video' : 'videos'}</MenuItem>
                ))}
              </Select>
            )} />
          <SettingRow controlId="preferredResolution" label="Preferred resolution" controlSize="select-compact"
            description="Youtarr takes the closest resolution YouTube has."
            control={(
              <Select id="preferredResolution" size="small" inputProps={describedBy('preferredResolution')}
                value={config.preferredResolution}
                onChange={(event: SelectChangeEvent<string>) => onConfigChange({ preferredResolution: event.target.value })}>
                {RESOLUTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </Select>
            )}>
            {(config.preferredResolution === '1440' || config.preferredResolution === '2160') && (
              <SettingNote tone="warning">
                1440p and 4K come as VP9 or AV1 (remuxed into MP4). Older Plex clients without VP9 or AV1 decoding may transcode.
              </SettingNote>
            )}
          </SettingRow>
          <SettingRow controlId="videoCodec" label="Preferred video codec" controlSize="select" stackControlOnPhone
            description="Used when YouTube has it; otherwise Youtarr falls back."
            tooltip="Default lets YouTube pick the best codec (typically VP9 or AV1 at 1440p and above)." onMobileTooltipClick={onMobileTooltipClick}
            control={(
              <Select id="videoCodec" size="small" inputProps={describedBy('videoCodec')}
                value={config.videoCodec}
                onChange={(event: SelectChangeEvent<string>) => onConfigChange({ videoCodec: event.target.value })}>
                {CODECS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </Select>
            )}>
            <SettingNote tone="info">
              H.264 direct-plays on the most devices (Apple TV HD, iOS, older Rokus), but YouTube only offers it up to 1080p, so it
              overrides a 1440p or 4K resolution.
            </SettingNote>
          </SettingRow>
          <SettingRow controlId="subtitlesEnabled" label="Subtitles"
            description="SRT files when available: manual subtitles first, auto-generated as a fallback."
            control={switchFor('subtitlesEnabled')}>
            {config.subtitlesEnabled && (
              <div className="mt-1 rounded-ui border border-border bg-background px-3.5 py-3">
                <p className="text-[13px] font-medium">Languages</p>
                <SubtitleLanguageSelector value={config.subtitleLanguage} onChange={(value) => onConfigChange({ subtitleLanguage: value })} />
                <p className="mt-2 text-[13px] text-muted-foreground">Videos without subtitles in these languages still download.</p>
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection id="media-server-files" title="Media server files"
          description="Extra files saved next to each download so media servers show full details and artwork.">
          {MEDIA_FILES.map((row) => (
            <SettingRow key={row.key} controlId={row.key} label={row.label} description={row.description} control={switchFor(row.key)} />
          ))}
          <div className={cn('flex items-start gap-2 bg-muted/30 text-[13px] text-muted-foreground', phone ? 'px-4 py-3.5' : 'px-5 py-4')}>
            <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-info" />
            <span>
              Which library type a folder needs depends on its layout: <strong className="text-foreground">Movies</strong> or{' '}
              <strong className="text-foreground">Other Videos</strong> for Videos folders, <strong className="text-foreground">TV Shows</strong> or{' '}
              <strong className="text-foreground">Shows</strong> for TV shows folders.{phone ? '' : ' Library folders shows the setup for every folder and checks your servers.'}{' '}
              <RouterLink to={LIBRARY_FOLDERS_PATH} className="text-primary underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center">Open Library folders</RouterLink>
            </span>
          </div>
        </SettingsSection>

        <SettingsSection id="naming" title="Naming"
          description={phone ? `How files in Videos folders are named. ${NAMING_TV_NOTE}` : 'How files in Videos folders are named and organized.'}
          aside={phone ? undefined : (
            <>
              <Chip icon={<Film size={12} aria-hidden="true" />} label="Videos folders only" size="small" variant="outlined" />
              <p className="mt-2.5 text-[13px] text-muted-foreground">{NAMING_TV_NOTE}</p>
            </>
          )}>
          <SettingRow controlId="defaultSkipVideoFolder" label="Flat file structure by default"
            description="Save new downloads directly in the channel folder instead of a folder per video. Channels can override this."
            control={(
              <Switch id="defaultSkipVideoFolder" name="defaultSkipVideoFolder" checked={config.defaultSkipVideoFolder}
                aria-describedby={settingDescriptionId('defaultSkipVideoFolder')}
                onChange={(event) => { if (event.target.checked !== config.defaultSkipVideoFolder) setPendingFlat(event.target.checked); }} />
            )} />
          <SettingRow controlId="prefixChannelNameInTitle" label="Channel name in embedded title"
            description={'Write the MP4 title as "Channel - Title"; Plex shows it as the video title. New downloads only.'}
            control={switchFor('prefixChannelNameInTitle')} />
          <SettingRow controlId="videoFilenamePrefix" label="Video filename template"
            description={(
              <>How yt-dlp names video files and per-video folders. Youtarr always adds <code className="font-mono">[VIDEO_ID].EXT</code> to file
                names and <code className="font-mono">- VIDEO_ID</code> to folder names so it can find your videos again. New downloads only.</>
            )}
            controlSize="link"
            control={(
              <a href="https://github.com/yt-dlp/yt-dlp#output-template" target="_blank" rel="noopener noreferrer" className="text-[13px] text-primary underline">
                {phone ? 'yt-dlp docs' : 'yt-dlp output template docs'}
              </a>
            )}>
            <VideoFilenameTemplate inputId="videoFilenamePrefix" value={config.videoFilenamePrefix}
              onChange={(value) => onConfigChange({ videoFilenamePrefix: value })} token={token}
              saveRequirement={filenameTemplateSaveRequirement} onPreviewSuccess={onFilenameTemplatePreviewSuccess} />
          </SettingRow>
        </SettingsSection>

        <SettingsSection id="interface" title="Interface" description="Applies to everyone who uses this Youtarr.">
          <SettingRow controlId="channelVideosHotLoad" label="Infinite scrolling (hot loading)"
            description="Channel lists, channel videos and download history load more as you scroll. Off: page-by-page controls."
            control={switchFor('channelVideosHotLoad')} />
        </SettingsSection>

        <SettingsSection id="advanced" title="Advanced" description="Download staging. Doesn't change where finished files go.">
          <SettingRow controlId="useTmpForDownloads" label="External temp directory"
            description="Download to /tmp first, then move finished files into the library. Faster with slow network storage. Off: a hidden .youtarr_tmp folder inside the downloads folder."
            tooltip={isPlatformManaged.useTmpForDownloads
              ? 'This setting is managed by your platform deployment and cannot be changed.'
              : 'Both options hide unfinished downloads from media servers. Off is faster on local or SSD storage.'}
            onMobileTooltipClick={onMobileTooltipClick}
            badge={isPlatformManaged.useTmpForDownloads ? <Chip label={elfhosted ? 'Managed by Elfhosted' : 'Platform Managed'} size="small" /> : undefined}
            control={switchFor('useTmpForDownloads', { disabled: isPlatformManaged.useTmpForDownloads })} />
        </SettingsSection>
      </div>

      <FlatStructureDialog open={pendingFlat !== null} turningOn={pendingFlat === true} token={token}
        onCancel={() => setPendingFlat(null)}
        onConfirm={() => { onConfigChange({ defaultSkipVideoFolder: pendingFlat === true }); setPendingFlat(null); }} />
    </div>
  );
};
