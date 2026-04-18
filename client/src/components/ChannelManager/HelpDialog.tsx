import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '../ui';
import {
  FileDownload as FileDownloadIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Video as VideoIcon,
  AudioIcon,
  AccessTime as AccessTimeIcon,
  HelpOutline as HelpOutlineIcon,
  EighteenUpRating as RatingIcon,
} from '../../lib/icons';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

interface LegendItemProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

const LegendItem: React.FC<LegendItemProps> = ({ icon, children }) => (
  <div className="flex items-start gap-2">
    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
      {icon}
    </span>
    <span className="flex-1">{children}</span>
  </div>
);

interface GuideSectionProps {
  number: number;
  title: string;
  summary: string;
  children?: React.ReactNode;
  isMobile: boolean;
}

const GuideSection: React.FC<GuideSectionProps> = ({ number, title, summary, children, isMobile }) => (
  <div className="flex items-start gap-3">
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: 28,
        height: 28,
        backgroundColor: 'var(--primary)',
        color: 'var(--primary-foreground)',
        fontSize: isMobile ? '13px' : '14px',
      }}
    >
      {number}
    </div>
    <div className="min-w-0 flex-1">
      <div
        className="font-semibold"
        style={{ fontSize: isMobile ? '14px' : '15px', color: 'var(--foreground)' }}
      >
        {title}
      </div>
      <div
        className="mt-1"
        style={{ fontSize: isMobile ? '13px' : '14px', color: 'var(--muted-foreground)' }}
      >
        {summary}
      </div>
      {children && (
        <div
          className="mt-2 flex flex-col gap-1.5"
          style={{ fontSize: isMobile ? '12.5px' : '13.5px', color: 'var(--muted-foreground)' }}
        >
          {children}
        </div>
      )}
    </div>
  </div>
);

function HelpDialog({ open, onClose, isMobile }: HelpDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby='help-dialog-title'
      maxWidth={false}
      fullWidth
      PaperProps={{ className: 'max-w-xl' }}
    >
      <DialogTitle id='help-dialog-title'>
        Channel Display Guide
      </DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-5 pt-1">
          <GuideSection
            number={1}
            title="Channel"
            summary="Channel thumbnail and name. Click to open the channel's videos page."
            isMobile={isMobile}
          />

          <GuideSection
            number={2}
            title="Quality / Folder"
            summary="Resolution, download subfolder, and content rating (when set)."
            isMobile={isMobile}
          >
            <LegendItem icon={<VideoIcon size={14} style={{ color: 'var(--muted-foreground)' }} />}>
              Grey chip = using the global default resolution.
            </LegendItem>
            <LegendItem icon={<SettingsIcon size={14} style={{ color: 'var(--success)' }} />}>
              Green chip = channel-specific quality override.
            </LegendItem>
            <LegendItem icon={<FolderIcon size={14} style={{ color: 'var(--muted-foreground)' }} />}>
              Download subfolder: <code>root</code> places files at the Youtarr root, <code>global default</code> follows the global setting, or a specific folder name.
            </LegendItem>
            <LegendItem icon={<RatingIcon size={14} style={{ color: 'var(--muted-foreground)' }} />}>
              Content rating badge (e.g. PG-13, TV-MA) appears when a default rating is set.
            </LegendItem>
          </GuideSection>

          <GuideSection
            number={3}
            title="Auto downloads"
            summary="Which content types exist on the channel and which are auto-downloaded."
            isMobile={isMobile}
          >
            <LegendItem icon={<FileDownloadIcon size={14} style={{ color: 'var(--primary)' }} />}>
              Filled chip with download icon = auto-download enabled for that tab (Videos, Shorts, or Live).
            </LegendItem>
            <LegendItem icon={<VideoIcon size={14} style={{ color: 'var(--muted-foreground)' }} />}>
              Outlined grey chip = tab is available on the channel but auto-download is off.
            </LegendItem>
            <LegendItem icon={<AudioIcon size={14} style={{ color: 'var(--muted-foreground)' }} />}>
              Audio icon = MP3 downloads are configured for this channel.
            </LegendItem>
          </GuideSection>

          <GuideSection
            number={4}
            title="Filters"
            summary="Per-channel download filters. Only shown when configured."
            isMobile={isMobile}
          >
            <LegendItem icon={<AccessTimeIcon size={14} style={{ color: 'var(--primary)' }} />}>
              Duration filter (e.g. <code>5-30m</code>, <code>&ge;10m</code>, <code>&le;60m</code>).
            </LegendItem>
            <LegendItem icon={<HelpOutlineIcon size={14} style={{ color: 'var(--secondary-foreground)' }} />}>
              Title regex filter. Click the chip to view the pattern.
            </LegendItem>
          </GuideSection>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='primary' autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default HelpDialog;
