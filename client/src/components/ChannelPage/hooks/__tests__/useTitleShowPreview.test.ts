import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useTitleShowPreview, PREVIEW_DEBOUNCE_MS } from '../useTitleShowPreview';
import { TitleShowDraft } from '../../../../types/titleShows';

const SHOWS: TitleShowDraft[] = [{ name: 'Beyblade', patterns: [{ text: 'Ep {episode}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' }] }];
const PREVIEW = { knownVideos: 3, shows: [] };

describe('useTitleShowPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    axios.post.mockResolvedValue({ data: PREVIEW });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('previews the drafts once they stop changing', async () => {
    const { result } = renderHook(() => useTitleShowPreview('UC1', 'token', SHOWS));
    expect(axios.post).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS); });
    await waitFor(() => expect(result.current.preview).toEqual(PREVIEW));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(axios.post).toHaveBeenCalledWith(
      '/api/channels/UC1/tv/preview', { shows: SHOWS, overrides: [] }, { headers: { 'x-access-token': 'token' } }
    );
  });

  test('waits for the drafts to settle before asking again', async () => {
    const { result, rerender } = renderHook(({ shows }: { shows: TitleShowDraft[] }) => useTitleShowPreview('UC1', 'token', shows), {
      initialProps: { shows: SHOWS },
    });
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS / 2); });
    rerender({ shows: [{ ...SHOWS[0], name: 'Beyblade!' }] });
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS / 2); });
    expect(axios.post).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS); });
    expect(axios.post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test('reports the server\'s refusal of a draft', async () => {
    axios.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: { error: 'Beyblade, pattern 1: bad' } } });
    const { result } = renderHook(() => useTitleShowPreview('UC1', 'token', SHOWS));
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS); });
    await waitFor(() => expect(result.current.error).toBe('Beyblade, pattern 1: bad'));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test('drops a preview that arrives after it was disabled', async () => {
    let answer: (value: unknown) => void = () => undefined;
    axios.post.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useTitleShowPreview('UC1', 'token', SHOWS, { enabled }), {
      initialProps: { enabled: true },
    });
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS); });
    rerender({ enabled: false });
    await act(async () => { answer({ data: PREVIEW }); });
    expect(result.current.preview).toBeNull();
  });

  test('clears the preview when disabled', async () => {
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useTitleShowPreview('UC1', 'token', SHOWS, { enabled }), {
      initialProps: { enabled: true },
    });
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS); });
    await waitFor(() => expect(result.current.preview).toEqual(PREVIEW));
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ enabled: false });
    expect([result.current.preview, result.current.error, result.current.loading]).toEqual([null, null, false]);
  });

  test('says whether the preview is for the current drafts', async () => {
    const { result, rerender } = renderHook(({ shows }: { shows: TitleShowDraft[] }) => useTitleShowPreview('UC1', 'token', shows), {
      initialProps: { shows: SHOWS },
    });
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS); });
    await waitFor(() => expect(result.current.current).toBe(true));
    rerender({ shows: [{ ...SHOWS[0], name: 'Beyblade!' }] });
    expect(result.current.current).toBe(false);
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS); });
    await waitFor(() => expect(result.current.current).toBe(true));
  });

  test('previews nothing while disabled', () => {
    renderHook(() => useTitleShowPreview('UC1', 'token', SHOWS, { enabled: false }));
    act(() => { jest.advanceTimersByTime(PREVIEW_DEBOUNCE_MS * 2); });
    expect(axios.post).not.toHaveBeenCalled();
  });
});
