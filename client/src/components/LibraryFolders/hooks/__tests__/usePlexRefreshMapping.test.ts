import { act, renderHook } from '@testing-library/react';
jest.mock('axios', () => ({ put: jest.fn(), delete: jest.fn(), isAxiosError: () => false }));
const axios = require('axios');
import { usePlexRefreshMapping } from '../usePlexRefreshMapping';

const saved = { mappedLibraryId: null, choice: 'default', plexSubfolderLibraryMappings: [{ subfolder: 'TV', libraryId: null }] };

describe('usePlexRefreshMapping', () => {
  test('stores the explicit default and patches the config', async () => {
    axios.put.mockResolvedValue({ data: saved });
    const patched = jest.fn();
    window.addEventListener('config-patched', patched);
    const { result } = renderHook(() => usePlexRefreshMapping('token'));

    await act(async () => { await result.current.setMapping('TV', null); });

    expect(axios.put).toHaveBeenCalledWith('/api/library-folders/plex-mapping', { folder: 'TV', libraryId: null, replace: true }, { headers: { 'x-access-token': 'token' } });
    expect((patched.mock.calls[0][0] as CustomEvent).detail).toEqual({ plexSubfolderLibraryMappings: saved.plexSubfolderLibraryMappings });
    window.removeEventListener('config-patched', patched);
  });

  test('removes a setting for the main folder', async () => {
    axios.delete.mockResolvedValue({ data: { ...saved, choice: 'none', plexSubfolderLibraryMappings: [] } });
    const { result } = renderHook(() => usePlexRefreshMapping('token'));
    await act(async () => { await result.current.removeMapping(''); });
    expect(axios.delete).toHaveBeenCalledWith('/api/library-folders/plex-mapping', { headers: { 'x-access-token': 'token' }, params: { folder: '' } });
  });

  test('throws the fallback message on failure', async () => {
    axios.put.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePlexRefreshMapping('token'));
    await act(async () => {
      await expect(result.current.setMapping('TV', '41')).rejects.toThrow('Could not save the Plex library mapping.');
    });
  });
});
