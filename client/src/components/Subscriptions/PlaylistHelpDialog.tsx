import React from 'react';
import { MAX_PLAYLIST_VIDEOS } from '../PlaylistPage/playlistConstants';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '../ui';
import {
  VideoLibrary as VideoLibraryIcon,
  Folder as FolderIcon,
  FileDownload as FileDownloadIcon,
  FileText as FileTextIcon,
  Server as ServerIcon,
} from '../../lib/icons';

interface PlaylistHelpDialogProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ icon, title, defaultExpanded, children }) => (
  <Accordion defaultExpanded={defaultExpanded}>
    <AccordionSummary>
      <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="font-semibold text-foreground">{title}</span>
    </AccordionSummary>
    <AccordionDetails>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
    </AccordionDetails>
  </Accordion>
);

function PlaylistHelpDialog({ open, onClose, isMobile }: PlaylistHelpDialogProps) {
  const iconColor = { color: 'var(--primary)' } as const;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="playlist-help-dialog-title"
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ className: 'max-w-xl' }}
    >
      <DialogTitle id="playlist-help-dialog-title">How playlists work</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-2 pt-1">
          <Section
            icon={<VideoLibraryIcon size={16} style={iconColor} />}
            title="Subscribing to a playlist"
            defaultExpanded
          >
            <p>
              Subscribe to a YouTube playlist the same way you subscribe to a channel. Youtarr
              tracks the playlist, pulls in its list of videos, and keeps that list in sync when the
              playlist changes on YouTube.
            </p>
            <p>
              Private and members-only videos can&apos;t be accessed, so they&apos;re left out of the
              list and never downloaded. The video count reflects only the videos Youtarr can see.
            </p>
          </Section>

          <Section icon={<FolderIcon size={16} style={iconColor} />} title="Where the videos are saved">
            <p>
              Playlists don&apos;t get their own folder. Each video is saved under the channel that
              uploaded it, so a playlist pulling from five channels lands in five channel folders.
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                If you&apos;re already subscribed to that channel, the video uses that channel&apos;s
                subfolder and quality settings.
              </li>
              <li>
                If you&apos;re not, the video is saved in the playlist&apos;s default subfolder (your
                global default, unless you&apos;ve changed it).
              </li>
            </ul>
            <p>So the same video never downloads twice just because it shows up in a playlist.</p>
          </Section>

          <Section icon={<FileDownloadIcon size={16} style={iconColor} />} title="Downloading automatically">
            <p>
              Enable auto-download to follow newly discovered entries on your regular download
              schedule, wherever the owner places them. Setup refreshes the playlist and lets you
              choose whether to download existing videos too. By default, existing videos are skipped.
              Each scheduled run allows up to your global count in new discoveries, plus the same
              number of older saved selections to retry. Older retries take turns. Pausing
              and resuming preserves tracking, and reordering a playlist does not create new entries.
            </p>
            <p>
              Use <strong>Choose existing videos</strong> to preview a batch by publication date,
              the beginning or end of the YouTube playlist, or manual selection. Previously downloaded
              and excluded videos are skipped. Missing publication dates require a positional or manual
              choice. The full selection queues immediately and does not reset automatic tracking.
              A selected video that is also a new discovery uses only the discovery allowance.
              Saved retries appear separately in Download History.
            </p>
            <p>
              <strong>Recently discovered by Youtarr</strong> sorts by when this installation first
              saw an entry. <strong>Recently downloaded</strong> uses download time, and
              <strong> Newest published</strong> uses the video&apos;s publication date. These are
              different dates; none tells you when the owner added a video to YouTube&apos;s playlist.
              Videos discovered together keep their playlist order. Published stays visible in every
              sort, with Discovered or Downloaded shown underneath when sorting by those dates.
              Downloaded is only shown for videos with a local file.
              Tap or click a discovery or download date to see its full timestamp.
            </p>
            <p>
              Automatic following supports playlists with up to {MAX_PLAYLIST_VIDEOS.toLocaleString()} entries and requires a complete refresh.
              In Playlist settings, <strong>Follow from now</strong> lets you skip the current
              undownloaded backlog after reviewing the change. Automatic downloads stay running or paused as they are now. It keeps files and already queued downloads.
            </p>
          </Section>

          <Section icon={<FileTextIcon size={16} style={iconColor} />} title="Playlist files (.m3u)">
            <p>
              For every playlist you subscribe to, Youtarr writes a standard <code>.m3u</code> file
              into a <code>__playlists__</code> folder next to your videos. It uses relative paths, so
              it keeps working if you move your library, and it&apos;s generated whether or not
              you&apos;ve connected a media server. Any player that reads <code>.m3u</code> files can
              open it. The file has one entry per downloaded item: the MP3 for MP3 Only playlists,
              the video file otherwise. If an item wasn&apos;t downloaded in that format, its other
              file is listed instead, so nothing is left out.
            </p>
          </Section>

          <Section icon={<ServerIcon size={16} style={iconColor} />} title="Syncing to Plex, Jellyfin, and Emby">
            <p>
              Youtarr can push playlists into Plex, Jellyfin, and Emby as native playlists. Set up the
              connection first under Settings, then turn on sync for the playlists you want. A few
              things worth knowing:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                <strong className="text-foreground font-medium">Plex:</strong> the playlist is created
                under a single account (yours). Plex won&apos;t show it to everyone automatically; to
                let other users see it, open the playlist in Plex and share it.
              </li>
              <li>
                <strong className="text-foreground font-medium">Jellyfin:</strong> works as
                you&apos;d expect, public playlists included.
              </li>
              <li>
                <strong className="text-foreground font-medium">Emby:</strong> supports shared
                playlists (Emby calls these &quot;collaborative&quot;), so turning on the public
                setting makes the playlist visible to other users.
              </li>
            </ul>
            <p>
              Playlists set to MP3 Only sync as music playlists (your server needs a music-type
              library that includes the Youtarr folder); every other playlist syncs as a video
              playlist. The playlist&apos;s Download Type setting decides this, and items
              downloaded in the other format are left out of the synced playlist.
            </p>
            <p>
              A video has to be in your media server&apos;s library before it can be added to the
              synced playlist, so a fresh download might take a scan cycle to show up.
            </p>
          </Section>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PlaylistHelpDialog;
