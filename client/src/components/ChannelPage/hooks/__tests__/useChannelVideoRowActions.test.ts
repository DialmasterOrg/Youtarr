import { act, renderHook } from '@testing-library/react';
import axios from 'axios';
import { useChannelVideoRowActions } from '../useChannelVideoRowActions';
import { useVideoProtection } from '../../../shared/useVideoProtection';
import { ChannelVideo } from '../../../../types/ChannelVideo';

jest.mock('../../../shared/useVideoProtection', () => ({
  useVideoProtection: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const mockPost = axios.post as jest.Mock;

type Props = Parameters<typeof useChannelVideoRowActions>[0];

// Shaped like an axios error: the request it was for rides along.
const serverError = Object.assign(new Error('Request failed with status code 500'), {
  response: { status: 500 },
  config: { headers: { 'x-access-token': 'test-token' } },
});

const video = (youtubeId: string, overrides: Partial<ChannelVideo> = {}): ChannelVideo => ({
  title: `Video ${youtubeId}`,
  youtube_id: youtubeId,
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnail: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
  added: false,
  duration: 300,
  media_type: 'video',
  live_status: null,
  ...overrides,
});

describe('useChannelVideoRowActions', () => {
  const saveProtection = jest.fn();
  const clearProtectionMessages = jest.fn();
  let props: Props;

  const stubProtection = (messages: { successMessage?: string; error?: string } = {}) => {
    (useVideoProtection as jest.Mock).mockReturnValue({
      toggleProtection: saveProtection,
      loading: false,
      successMessage: messages.successMessage ?? null,
      error: messages.error ?? null,
      clearMessages: clearProtectionMessages,
    });
  };

  const renderActions = (overrides: Partial<Props> = {}) =>
    renderHook(() => useChannelVideoRowActions({ ...props, ...overrides }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockReset();
    mockPost.mockResolvedValue({ data: { success: true } });
    stubProtection();
    props = {
      channelId: 'UC123',
      token: 'test-token',
      videos: [
        video('plain1', { id: 11 }),
        video('ignored1', { ignored: true }),
        video('protected1', { id: 12, added: true, protected: true }),
        video('unsaved1'),
      ],
      setIgnored: jest.fn(),
      setProtected: jest.fn(),
      refetchTabStats: jest.fn().mockResolvedValue(undefined),
      notify: jest.fn(),
    };
  });

  describe('toggleIgnore', () => {
    test('ignores a video that is not ignored', async () => {
      const { result } = renderActions();

      await act(() => result.current.toggleIgnore('plain1'));

      expect(mockPost).toHaveBeenCalledWith('/api/channels/UC123/videos/plain1/ignore', undefined, {
        headers: { 'x-access-token': 'test-token' },
      });
      expect(props.setIgnored).toHaveBeenCalledWith({ plain1: true });
      expect(props.notify).toHaveBeenCalledWith('Video ignored. Channel downloads will exclude this video');
    });

    test('unignores a video that is ignored', async () => {
      const { result } = renderActions();

      await act(() => result.current.toggleIgnore('ignored1'));

      expect(mockPost).toHaveBeenCalledWith(
        '/api/channels/UC123/videos/ignored1/unignore',
        undefined,
        expect.anything()
      );
      expect(props.setIgnored).toHaveBeenCalledWith({ ignored1: false });
      expect(props.notify).toHaveBeenCalledWith('Video unignored. Channel downloads will include this video');
    });

    test('shows the change on the row before the server answers', () => {
      mockPost.mockReturnValue(new Promise(() => {}));
      const { result } = renderActions();

      act(() => {
        void result.current.toggleIgnore('plain1');
      });

      expect(props.setIgnored).toHaveBeenCalledWith({ plain1: true });
    });

    test('refreshes the tab counts after the change is saved', async () => {
      const { result } = renderActions();

      await act(() => result.current.toggleIgnore('plain1'));

      expect(props.refetchTabStats).toHaveBeenCalledTimes(1);
    });

    test('puts the row back and reports the failure when the server refuses', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockPost.mockRejectedValue(serverError);
      const { result } = renderActions();

      await act(() => result.current.toggleIgnore('plain1'));

      expect(props.setIgnored).toHaveBeenLastCalledWith({ plain1: false });
      expect(props.notify).toHaveBeenCalledWith('Failed to ignore video', 'error');
      expect(props.refetchTabStats).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    test('logs the failure without the request and its session token', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockPost.mockRejectedValue(serverError);
      const { result } = renderActions();

      await act(() => result.current.toggleIgnore('plain1'));

      expect(consoleError).toHaveBeenCalledWith('Error toggling ignore:', {
        message: 'Request failed with status code 500',
        status: 500,
      });
      consoleError.mockRestore();
    });

    test.each([
      ['a channel', { channelId: undefined }],
      ['a token', { token: null }],
    ])('does nothing without %s', async (_case, overrides) => {
      const { result } = renderActions(overrides);

      await act(() => result.current.toggleIgnore('plain1'));

      expect(mockPost).not.toHaveBeenCalled();
      expect(props.setIgnored).not.toHaveBeenCalled();
    });
  });

  describe('toggleProtection', () => {
    test('saves the opposite of the current protection and shows what the server stored', async () => {
      saveProtection.mockResolvedValue(false);
      const { result } = renderActions();

      await act(() => result.current.toggleProtection('protected1'));

      expect(saveProtection).toHaveBeenCalledWith(12, true);
      expect(props.setProtected).toHaveBeenCalledWith('protected1', false);
    });

    test('treats a video with no protection flag as unprotected', async () => {
      saveProtection.mockResolvedValue(true);
      const { result } = renderActions();

      await act(() => result.current.toggleProtection('plain1'));

      expect(saveProtection).toHaveBeenCalledWith(11, false);
    });

    test('leaves the row alone when saving fails', async () => {
      saveProtection.mockResolvedValue(undefined);
      const { result } = renderActions();

      await act(() => result.current.toggleProtection('protected1'));

      expect(props.setProtected).not.toHaveBeenCalled();
    });

    test('does nothing for a video without a database record', async () => {
      const { result } = renderActions();

      await act(() => result.current.toggleProtection('unsaved1'));

      expect(saveProtection).not.toHaveBeenCalled();
    });

    test('passes on the success message once', () => {
      stubProtection({ successMessage: 'Video protected from auto-deletion' });

      renderActions();

      expect(props.notify).toHaveBeenCalledWith('Video protected from auto-deletion');
      expect(clearProtectionMessages).toHaveBeenCalledTimes(1);
    });

    test('passes on the error as an error', () => {
      stubProtection({ error: 'Video not found' });

      renderActions();

      expect(props.notify).toHaveBeenCalledWith('Video not found', 'error');
      expect(clearProtectionMessages).toHaveBeenCalledTimes(1);
    });
  });
});
