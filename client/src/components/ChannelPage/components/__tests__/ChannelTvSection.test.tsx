import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelTvSection, { ChannelTvSectionProps } from '../ChannelTvSection';
import { ChannelTvState, LibraryFolder } from '../../../../types/tvShows';

const videosTv: ChannelTvState = {
  layout: 'videos',
  libraryFolder: 'Gaming',
  show: null,
  tvFolders: ['Anime'],
  defaultFolder: '',
  defaultFolderLayout: 'videos',
  hasDownloads: false,
};

const tvTv: ChannelTvState = {
  ...videosTv,
  layout: 'tv',
  libraryFolder: 'Anime',
  show: { name: 'Tech Show', folderName: 'Tech Show', libraryFolder: 'Anime', path: '/videos/__Anime/Tech Show' },
};

const folder = (name: string, layout: 'videos' | 'tv'): LibraryFolder => ({
  name,
  layout,
  isDefault: false,
  hasFiles: false,
  channels: 0,
});

const libraryFolders = [folder('', 'videos'), folder('Gaming', 'videos'), folder('Anime', 'tv')];

function renderSection(overrides: Partial<ChannelTvSectionProps> = {}) {
  const props: ChannelTvSectionProps = {
    channelName: 'Tech Channel',
    tv: videosTv,
    loading: false,
    error: null,
    folders: libraryFolders,
    onSwitch: jest.fn().mockResolvedValue(undefined),
    createSubfolder: jest.fn().mockResolvedValue(undefined),
    setFolderLayout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<ChannelTvSection {...props} />);
  return { props, user: userEvent.setup() };
}

describe('ChannelTvSection', () => {
  describe('destination', () => {
    test('describes where a Videos channel saves its videos', () => {
      renderSection();

      expect(screen.getByText('Videos are saved movie-style in __Gaming.')).toBeInTheDocument();
    });

    test("describes where a TV channel's episodes go", () => {
      renderSection({ tv: tvTv });

      expect(screen.getByText('Episodes go to __Anime/Tech Show/Season YYYY/')).toBeInTheDocument();
    });

    test('uses the channel name before the show exists', () => {
      renderSection({ tv: { ...tvTv, libraryFolder: '', show: null } });

      expect(screen.getByText('Episodes go to Main folder/Tech Channel/Season YYYY/')).toBeInTheDocument();
    });
  });

  test('marks the current layout as pressed', () => {
    renderSection({ tv: tvTv });

    expect(screen.getByRole('button', { name: 'TV show' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('lets a channel with downloads switch and says the move is reviewed first', () => {
    renderSection({ tv: { ...videosTv, hasDownloads: true } });

    expect(screen.getByRole('button', { name: 'TV show' })).toBeEnabled();
    expect(
      screen.getByText('This channel has downloaded videos: switching moves them, and you review the move first.')
    ).toBeInTheDocument();
  });

  test('locks both choices while the channel\'s files are being moved', () => {
    renderSection({ tv: { ...videosTv, hasDownloads: true, reorganize: { running: true, unmoved: null } } });

    expect(screen.getByRole('button', { name: 'Videos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'TV show' })).toBeDisabled();
    expect(screen.getByText("This channel's downloaded videos are being moved.")).toBeInTheDocument();
  });

  test('offers to review videos a reorganize left unmoved', async () => {
    const onShowReorganize = jest.fn();
    const { user } = renderSection({
      tv: { ...tvTv, reorganize: { running: false, unmoved: { operationId: 7, failed: 2, status: 'partial' } } },
      onShowReorganize,
    });

    expect(screen.getByText('2 videos were not moved when this channel was reorganized.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(onShowReorganize).toHaveBeenCalledWith(7);
  });

  describe('switching to TV', () => {
    test('switches straight to the only TV folder', async () => {
      const { props, user } = renderSection();

      await user.click(screen.getByRole('button', { name: 'TV show' }));

      expect(props.onSwitch).toHaveBeenCalledWith('tv', undefined);
    });

    test('switches straight away when the default subfolder is a TV folder', async () => {
      const { props, user } = renderSection({
        tv: { ...videosTv, tvFolders: ['Anime', 'Kids'], defaultFolder: 'Kids', defaultFolderLayout: 'tv' },
      });

      await user.click(screen.getByRole('button', { name: 'TV show' }));

      expect(props.onSwitch).toHaveBeenCalledWith('tv', undefined);
    });

    test('asks which TV folder to use when there are several', async () => {
      const { props, user } = renderSection({ tv: { ...videosTv, tvFolders: ['Anime', 'Kids'] } });

      await user.click(screen.getByRole('button', { name: 'TV show' }));
      await user.click(screen.getByLabelText('TV folder'));
      await user.click(await screen.findByRole('option', { name: '__Kids' }));
      await user.click(screen.getByRole('button', { name: 'Switch to TV show' }));

      expect(props.onSwitch).toHaveBeenCalledWith('tv', 'Kids');
    });

    test('sets up a TV folder when none exists, then switches to it', async () => {
      const calls: string[] = [];
      const { user } = renderSection({
        tv: { ...videosTv, tvFolders: [] },
        createSubfolder: jest.fn(async (name: string) => { calls.push(`create:${name}`); }),
        setFolderLayout: jest.fn(async (name: string, layout: string) => { calls.push(`layout:${name}:${layout}`); }),
        onSwitch: jest.fn(async (layout: string, target?: string) => { calls.push(`switch:${layout}:${target}`); }),
      });

      await user.click(screen.getByRole('button', { name: 'TV show' }));
      await user.click(screen.getByRole('button', { name: 'Create TV folder' }));

      await waitFor(() => {
        expect(calls).toEqual(['create:TV Shows', 'layout:TV Shows:tv', 'switch:tv:TV Shows']);
      });
    });

    test('shows the media server notes during setup', async () => {
      const { user } = renderSection({ tv: { ...videosTv, tvFolders: [] } });

      await user.click(screen.getByRole('button', { name: 'TV show' }));

      expect(screen.getByText('Media server setup')).toBeInTheDocument();
    });

    test("shows the server's refusal", async () => {
      const refusal = "TV shows are video-only. Change this channel's download type to Video before saving it to a TV folder.";
      const { user } = renderSection({ onSwitch: jest.fn().mockRejectedValue(new Error(refusal)) });

      await user.click(screen.getByRole('button', { name: 'TV show' }));

      expect(await screen.findByText(refusal)).toBeInTheDocument();
    });
  });

  describe('switching to Videos', () => {
    test('switches back without asking when the server knows the folder', async () => {
      const { props, user } = renderSection({ tv: tvTv });

      await user.click(screen.getByRole('button', { name: 'Videos' }));

      expect(props.onSwitch).toHaveBeenCalledWith('videos', undefined);
    });

    test('asks for a Videos folder when the server needs one, then retries with it', async () => {
      const onSwitch = jest.fn()
        .mockRejectedValueOnce(new Error('Choose a Videos folder.'))
        .mockResolvedValueOnce(undefined);
      const { user } = renderSection({ tv: tvTv, onSwitch });

      await user.click(screen.getByRole('button', { name: 'Videos' }));
      await user.click(await screen.findByLabelText('Videos folder'));
      await user.click(await screen.findByRole('option', { name: '__Gaming' }));
      await user.click(screen.getByRole('button', { name: 'Switch to Videos' }));

      expect(onSwitch).toHaveBeenLastCalledWith('videos', 'Gaming');
    });

    test('offers only Videos-layout folders', async () => {
      const onSwitch = jest.fn().mockRejectedValueOnce(new Error('Choose a Videos folder.'));
      const { user } = renderSection({ tv: tvTv, onSwitch });

      await user.click(screen.getByRole('button', { name: 'Videos' }));
      await user.click(await screen.findByLabelText('Videos folder'));

      expect(await screen.findAllByRole('option')).toHaveLength(2);
    });
  });

  test('explains that the default subfolder is a TV folder', () => {
    renderSection({ tv: { ...videosTv, defaultFolder: 'Anime', defaultFolderLayout: 'tv' } });

    expect(
      screen.getByText(
        "The default subfolder is a TV folder, so downloads from channels you haven't subscribed to are each saved as their own TV show."
      )
    ).toBeInTheDocument();
  });

  test('shows the media server notes for a TV channel', () => {
    renderSection({ tv: tvTv });

    expect(screen.getByText(/Plex: add a TV Shows library for this folder/)).toBeInTheDocument();
  });

  test('hides the media server notes for a Videos channel', () => {
    renderSection();

    expect(screen.queryByText('Media server setup')).not.toBeInTheDocument();
  });

  test('shows a spinner while the TV state loads', () => {
    renderSection({ tv: null, loading: true });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('shows the load error when the TV state could not load', () => {
    renderSection({ tv: null, error: "Failed to load the channel's TV settings" });

    expect(screen.getByText("Failed to load the channel's TV settings")).toBeInTheDocument();
  });
});
