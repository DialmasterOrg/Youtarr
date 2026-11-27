import { ChannelVideo } from '../../../types/ChannelVideo';
import {
  canSelectForDelete,
  canSelectForDownload,
  getChannelVideoRowState,
  toggleRowSelection,
} from '../channelVideoRowState';

const video = (overrides: Partial<ChannelVideo> = {}): ChannelVideo => ({
  title: 'Video',
  youtube_id: 'vid1',
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnail: '',
  added: false,
  duration: 300,
  media_type: 'video',
  live_status: null,
  ...overrides,
});

describe('channelVideoRowState', () => {
  test.each([
    ['a never downloaded video', {}, true],
    ['an ignored video', { ignored: true }, true],
    ['a video whose file is gone', { added: true, removed: true }, true],
    ['a video with its file', { added: true, removed: false }, false],
    ['a video YouTube removed', { youtube_removed: true }, false],
    ['a live stream that has not ended', { live_status: 'is_live' }, false],
    ['a stream that has not started', { live_status: 'is_upcoming' }, false],
    ['a live stream that has ended', { live_status: 'was_live' }, true],
    ['a video reported as never live', { live_status: 'not_live' }, true],
  ])('download selection for %s', (_case, overrides, expected) => {
    expect(canSelectForDownload(video(overrides))).toBe(expected);
  });

  test.each([
    ['a video with its file', { added: true, removed: false }, true],
    ['a video whose file is gone', { added: true, removed: true }, false],
    ['a never downloaded video', {}, false],
    ['a live stream that has not ended', { added: true, live_status: 'is_live' }, false],
    ['a video with its file reported as never live', { added: true, live_status: 'not_live' }, true],
  ])('delete selection for %s', (_case, overrides, expected) => {
    expect(canSelectForDelete(video(overrides))).toBe(expected);
  });

  test('offers only the kind of selection the current mode allows', () => {
    const downloadable = video();
    const deletable = video({ added: true });

    expect(getChannelVideoRowState(downloadable, 'delete', [], []).canDownload).toBe(false);
    expect(getChannelVideoRowState(deletable, 'download', [], []).canDelete).toBe(false);
    expect(getChannelVideoRowState(deletable, 'delete', [], ['vid1'])).toMatchObject({
      canDelete: true,
      isDeleteChecked: true,
    });
  });

  test('a row click toggles the selection the row offers, and nothing on a row that offers none', () => {
    const onCheckChange = jest.fn();
    const onDeletionChange = jest.fn();
    const toggle = (target: ChannelVideo, checked: string[] = []) =>
      toggleRowSelection(target, getChannelVideoRowState(target, null, checked, []), onCheckChange, onDeletionChange);

    toggle(video(), ['vid1']);
    toggle(video({ added: true }));
    toggle(video({ youtube_removed: true }));

    expect(onCheckChange.mock.calls).toEqual([['vid1', false]]);
    expect(onDeletionChange.mock.calls).toEqual([['vid1', true]]);
  });
});
