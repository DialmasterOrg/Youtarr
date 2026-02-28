import React, { useMemo, useState } from 'react';
import ChannelVideosHeader from './ChannelVideosHeader';
import { ChannelVideo } from '../../types/ChannelVideo';

const videos: ChannelVideo[] = [
  {
    title: 'Demo Not Downloaded',
    youtube_id: 'demo-video-1',
    publishedAt: '2024-01-01T00:00:00Z',
    thumbnail: '',
    added: false,
    removed: false,
    duration: 300,
    media_type: 'video',
    live_status: null,
  },
  {
    title: 'Demo Downloaded',
    youtube_id: 'demo-video-2',
    publishedAt: '2024-01-02T00:00:00Z',
    thumbnail: '',
    added: true,
    removed: false,
    duration: 180,
    media_type: 'video',
    live_status: null,
  },
];

const baseArgs = {
  isMobile: false,
  viewMode: 'grid' as const,
  searchQuery: '',
  hideDownloaded: false,
  totalCount: 12,
  oldestVideoDate: '2024-01-01T00:00:00Z',
  fetchingAllVideos: false,
  checkedBoxes: [] as string[],
  selectedForDeletion: [] as string[],
  selectionMode: null as 'download' | 'delete' | null,
  deleteLoading: false,
  paginatedVideos: videos,
  autoDownloadsEnabled: false,
  selectedTab: 'videos',
  maxRating: 'all',
  onViewModeChange: () => {},
  onSearchChange: () => {},
  onHideDownloadedChange: () => {},
  onRefreshClick: () => {},
  onDownloadClick: () => {},
  onSelectAllDownloaded: () => {},
  onSelectAllNotDownloaded: () => {},
  onClearSelection: () => {},
  onDeleteClick: () => {},
  onBulkIgnoreClick: () => {},
  onInfoIconClick: () => {},
  onMaxRatingChange: () => {},
  onAutoDownloadToggle: () => {},
  activeFilterCount: 0,
  filtersExpanded: false,
  onFiltersExpandedChange: () => {},
};

const meta = {
  title: 'ChannelPage/ChannelVideosHeader',
  component: ChannelVideosHeader,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;

const InteractiveHeaderStory: React.FC<{
  checkedBoxes?: string[];
  selectedForDeletion?: string[];
  selectionMode?: 'download' | 'delete' | null;
}> = ({ checkedBoxes = [], selectedForDeletion = [], selectionMode = null }) => {
  const [lastAction, setLastAction] = useState('none');

  const args = useMemo(() => ({
    ...baseArgs,
    checkedBoxes,
    selectedForDeletion,
    selectionMode,
    onSelectAllDownloaded: () => setLastAction('select-all-downloaded'),
    onSelectAllNotDownloaded: () => setLastAction('select-all-not-downloaded'),
    onClearSelection: () => setLastAction('clear-selection'),
    onDownloadClick: () => setLastAction('download-selected'),
    onDeleteClick: () => setLastAction('delete-selected'),
    onBulkIgnoreClick: () => setLastAction('ignore-selected'),
  }), [checkedBoxes, selectedForDeletion, selectionMode]);

  return (
    <div>
      <ChannelVideosHeader {...args} />
      <div style={{ marginTop: 8, fontSize: 12 }} data-testid="last-action">last-action:{lastAction}</div>
    </div>
  );
};

const clickElementByText = async (root: HTMLElement, text: RegExp) => {
  const elements = Array.from(root.querySelectorAll('button, [role="menuitem"]'));
  const target = elements.find((element) => text.test(element.textContent || '')) as HTMLElement | undefined;
  if (!target) {
    throw new Error(`Could not find element matching ${String(text)}`);
  }
  target.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const getMenuItems = () => Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLElement[];

const expectMenuItem = (matcher: RegExp) => {
  const item = getMenuItems().find((element) => matcher.test(element.textContent || ''));
  if (!item) {
    throw new Error(`Menu item not found: ${String(matcher)}`);
  }
  return item;
};

const clickMenuItem = async (matcher: RegExp) => {
  const item = expectMenuItem(matcher);
  item.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

export const Default = {
  args: {
    ...baseArgs,
  },
};

export const WithDownloadSelection = {
  args: {
    ...baseArgs,
    checkedBoxes: ['demo-video-1'],
    selectionMode: 'download',
  },
};

export const WithDeleteSelection = {
  args: {
    ...baseArgs,
    selectedForDeletion: ['demo-video-2'],
    selectionMode: 'delete',
  },
};

export const AutoDownloadsEnabled = {
  args: {
    ...baseArgs,
    autoDownloadsEnabled: true,
  },
};

export const AutoDownloadsDisabled = {
  args: {
    ...baseArgs,
    autoDownloadsEnabled: false,
  },
};

export const ActionsMenuNoSelection = {
  render: () => <InteractiveHeaderStory />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    await clickElementByText(canvasElement, /^Actions$/i);

    const menuItems = Array.from(canvasElement.querySelectorAll('[role="menuitem"]')).map((item: Element) => item.textContent || '');
    if (!menuItems.some((item) => /Select All \(Downloaded\)/i.test(item))) {
      throw new Error('Downloaded selection action is missing');
    }
    if (!menuItems.some((item) => /Select All \(Not Downloaded\)/i.test(item))) {
      throw new Error('Not-downloaded selection action is missing');
    }
    if (menuItems.some((item) => /Clear Selection|Download Selected|Delete Selected|Ignore Selected/i.test(item))) {
      throw new Error('Selection-only actions should be hidden with no selection');
    }
  },
};

export const ActionsMenuDownloadSelection = {
  render: () => <InteractiveHeaderStory checkedBoxes={['demo-video-1']} selectionMode="download" />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    await clickElementByText(canvasElement, /^Actions$/i);
    await clickElementByText(canvasElement, /Download Selected/i);

    const lastAction = canvasElement.querySelector('[data-testid="last-action"]')?.textContent || '';
    if (!/last-action:download-selected/.test(lastAction)) {
      throw new Error('Download action callback did not fire');
    }
  },
};

export const ActionsMenuDeleteSelection = {
  render: () => <InteractiveHeaderStory selectedForDeletion={['demo-video-2']} selectionMode="delete" />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    await clickElementByText(canvasElement, /^Actions$/i);
    await clickElementByText(canvasElement, /Delete Selected/i);

    const lastAction = canvasElement.querySelector('[data-testid="last-action"]')?.textContent || '';
    if (!/last-action:delete-selected/.test(lastAction)) {
      throw new Error('Delete action callback did not fire');
    }
  },
};

export const ActionsMenuComprehensive = {
  render: () => <InteractiveHeaderStory checkedBoxes={['demo-video-1']} selectedForDeletion={['demo-video-2']} selectionMode="download" />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const actionsButton = Array.from(canvasElement.querySelectorAll('button')).find((button) => /^Actions$/i.test(button.textContent || '')) as HTMLButtonElement | undefined;
    if (!actionsButton) {
      throw new Error('Actions button is missing');
    }

    actionsButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expectMenuItem(/Select All \(Downloaded\)/i);
    expectMenuItem(/Select All \(Not Downloaded\)/i);
    expectMenuItem(/Clear Selection/i);
    expectMenuItem(/Download Selected \(1\)/i);
    expectMenuItem(/Delete Selected \(1\)/i);
    expectMenuItem(/Ignore Selected \(1\)/i);

    await clickMenuItem(/Download Selected \(1\)/i);
    const afterDownload = canvasElement.querySelector('[data-testid="last-action"]')?.textContent || '';
    if (!/last-action:download-selected/.test(afterDownload)) {
      throw new Error('Download action callback did not fire in comprehensive flow');
    }

    actionsButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await clickMenuItem(/Delete Selected \(1\)/i);
    const afterDelete = canvasElement.querySelector('[data-testid="last-action"]')?.textContent || '';
    if (!/last-action:delete-selected/.test(afterDelete)) {
      throw new Error('Delete action callback did not fire in comprehensive flow');
    }

    actionsButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await clickMenuItem(/Ignore Selected \(1\)/i);
    const afterIgnore = canvasElement.querySelector('[data-testid="last-action"]')?.textContent || '';
    if (!/last-action:ignore-selected/.test(afterIgnore)) {
      throw new Error('Ignore action callback did not fire in comprehensive flow');
    }

    actionsButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await clickMenuItem(/Clear Selection/i);
    const afterClear = canvasElement.querySelector('[data-testid="last-action"]')?.textContent || '';
    if (!/last-action:clear-selection/.test(afterClear)) {
      throw new Error('Clear-selection callback did not fire in comprehensive flow');
    }
  },
};