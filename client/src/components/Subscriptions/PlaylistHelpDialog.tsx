import React from 'react';
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
              Turn on auto-download for a playlist and Youtarr keeps it current on the regular
              download schedule, the same way it does for channels. It grabs the newest videos in the
              playlist, up to the count you set under{' '}
              <strong className="text-foreground font-medium">
                Settings &rarr; Core Settings &rarr; Download Settings
              </strong>
              , and skips anything you already have or have marked as ignored. New videos added to the
              playlist later get picked up on their own.
            </p>
          </Section>

          <Section icon={<FileTextIcon size={16} style={iconColor} />} title="Playlist files (.m3u)">
            <p>
              For every playlist you subscribe to, Youtarr writes a standard <code>.m3u</code> file
              into a <code>__playlists__</code> folder next to your videos. It uses relative paths, so
              it keeps working if you move your library, and it&apos;s generated whether or not
              you&apos;ve connected a media server. Any player that reads <code>.m3u</code> files can
              open it. The file lists the videos you&apos;ve actually downloaded.
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
