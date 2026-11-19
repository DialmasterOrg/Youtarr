import { act, renderHook } from '@testing-library/react';
jest.mock('axios', () => ({ put: jest.fn(), get: jest.fn(), isAxiosError: () => false }));
const axios = require('axios');
import { useDefaultFolder } from '../useDefaultFolder';

describe('useDefaultFolder', () => {
  test('saves and patches the config with the saved default', async () => {
    axios.put.mockResolvedValue({ data: { changed: true, defaultSubfolder: 'TV' } });
    const patched = jest.fn();
    window.addEventListener('config-patched', patched);
    const { result } = renderHook(() => useDefaultFolder('token'));

    await act(async () => { await result.current.setDefaultFolder('TV'); });

    expect((patched.mock.calls[0][0] as CustomEvent).detail).toEqual({ defaultSubfolder: 'TV' });
    window.removeEventListener('config-patched', patched);
  });

  test('reads the default back from the folder list and patches the config with it', async () => {
    axios.get.mockResolvedValue({ data: { folders: [
      { name: '', isDefault: false }, { name: 'Kids', isDefault: true },
    ] } });
    const patched = jest.fn();
    window.addEventListener('config-patched', patched);
    const { result } = renderHook(() => useDefaultFolder('token'));
    let value;
    await act(async () => { value = await result.current.readBackDefault(); });
    expect(value).toBe('Kids');
    expect((patched.mock.calls[0][0] as CustomEvent).detail).toEqual({ defaultSubfolder: 'Kids' });
    window.removeEventListener('config-patched', patched);
  });
});
