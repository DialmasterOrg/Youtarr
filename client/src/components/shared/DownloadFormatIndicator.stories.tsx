import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import DownloadFormatIndicator from './DownloadFormatIndicator';

const meta: Meta<typeof DownloadFormatIndicator> = {
  title: 'Shared/DownloadFormatIndicator',
  component: DownloadFormatIndicator,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof DownloadFormatIndicator>;

// ─── Video only ───────────────────────────────────────────────────────────────
export const VideoOnly: Story = {
  args: {
    filePath: '/usr/src/app/data/NFL/Super Bowl Highlights.mkv',
    fileSize: 1073741824, // 1 GB
  },
};

// ─── Audio only ───────────────────────────────────────────────────────────────
export const AudioOnly: Story = {
  args: {
    audioFilePath: '/usr/src/app/data/Cercle/Live Set.mp3',
    audioFileSize: 52428800, // 50 MB
  },
};

// ─── Video + Separate Audio ───────────────────────────────────────────────────
export const VideoAndAudio: Story = {
  args: {
    filePath: '/usr/src/app/data/Blippi/Animals Episode.mkv',
    fileSize: 536870912, // 512 MB
    audioFilePath: '/usr/src/app/data/Blippi/Animals Episode.mp3',
    audioFileSize: 26214400, // 25 MB
  },
};

// ─── Nothing (renders null) ───────────────────────────────────────────────────
export const Empty: Story = {
  args: {},
  render: () => (
    <div className="text-sm text-muted-foreground">
      No indicator shown when no file paths provided: &nbsp;
      <DownloadFormatIndicator />
    </div>
  ),
};

// ─── Unknown file size ────────────────────────────────────────────────────────
export const UnknownSize: Story = {
  args: {
    filePath: '/usr/src/app/data/NFL/Game.mkv',
    fileSize: null,
  },
};

// ─── Group of indicators ─────────────────────────────────────────────────────
export const MultipleRows: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs w-32 text-muted-foreground">Video + Audio:</span>
        <DownloadFormatIndicator
          filePath="/usr/src/app/data/show/ep1.mkv"
          fileSize={1073741824}
          audioFilePath="/usr/src/app/data/show/ep1.mp3"
          audioFileSize={25165824}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs w-32 text-muted-foreground">Video only:</span>
        <DownloadFormatIndicator filePath="/usr/src/app/data/show/ep2.mkv" fileSize={536870912} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs w-32 text-muted-foreground">Audio only:</span>
        <DownloadFormatIndicator audioFilePath="/usr/src/app/data/show/ep3.mp3" audioFileSize={10485760} />
      </div>
    </div>
  ),
};
