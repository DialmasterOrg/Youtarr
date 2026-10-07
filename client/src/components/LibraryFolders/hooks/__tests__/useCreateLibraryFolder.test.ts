import { act, renderHook } from '@testing-library/react';
jest.mock('axios', () => ({ post: jest.fn(), isAxiosError: jest.fn() }));
const axios = require('axios');
import { useCreateLibraryFolder } from '../useCreateLibraryFolder';
import { ReorganizeRequiredError } from '../../../shared/Reorganize';

describe('useCreateLibraryFolder', () => {
  beforeEach(() => {
    axios.isAxiosError.mockImplementation((err: { isAxiosError?: boolean }) => Boolean(err && err.isAxiosError));
  });

  test('creates and announces the folder', async () => {
    axios.post.mockResolvedValue({ data: { name: 'Science', layout: 'tv', created: true, existingContent: false } });
    const listener = jest.fn();
    window.addEventListener('library-folders-updated', listener);
    const { result } = renderHook(() => useCreateLibraryFolder('token'));

    let created;
    await act(async () => { created = await result.current.createFolder('Science', 'tv'); });

    expect(created).toEqual({ name: 'Science', layout: 'tv', created: true, existingContent: false });
    expect(axios.post).toHaveBeenCalledWith('/api/subfolders', { name: 'Science', layout: 'tv' }, { headers: { 'x-access-token': 'token' } });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('library-folders-updated', listener);
  });

  test('turns a reorganize refusal into a ReorganizeRequiredError', async () => {
    axios.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: {
      error: 'Review the move', reorganizeRequired: true, change: { type: 'folderLayout', folder: 'Old', layout: 'tv' },
    } } });
    const { result } = renderHook(() => useCreateLibraryFolder('token'));
    await act(async () => {
      await expect(result.current.createFolder('Old', 'tv')).rejects.toBeInstanceOf(ReorganizeRequiredError);
    });
  });
});
