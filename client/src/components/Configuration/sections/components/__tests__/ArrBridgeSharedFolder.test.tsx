import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeSharedFolder } from '../ArrBridgeSharedFolder';
import { renderWithProviders } from '../../../../../test-utils';

const IN_YOUTARR = '/usr/src/app/data/.arr-staging';
const SEEN = { ok: true, visible: true, path: IN_YOUTARR };
const NOT_SEEN = { ok: true, visible: false, path: IN_YOUTARR };
const DIFFERENT_PATH = 'Sonarr and Radarr see this folder under a different path';
const PATH_FIELD = "The folder's path inside Sonarr and Radarr";

const setup = (overrides: Partial<React.ComponentProps<typeof ArrBridgeSharedFolder>> = {}) => {
  const props: React.ComponentProps<typeof ArrBridgeSharedFolder> = {
    hostFolder: '/mnt/media/youtube/.arr-staging',
    connected: { sonarr: true, radarr: true },
    checks: { sonarr: SEEN, radarr: SEEN },
    checking: false,
    onRecheck: jest.fn(),
    stagingPath: '',
    stagingPathSaved: true,
    onStagingPathChange: jest.fn(),
    retentionDays: 7,
    onRetentionDaysChange: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeSharedFolder {...props} />);
  return props;
};

const checkOf = (app: string) => within(screen.getByRole('listitem', { name: `${app} folder check` }));

describe('ArrBridgeSharedFolder', () => {
  test('names the folder as the user knows it, not by its path inside Youtarr', () => {
    setup();

    expect(screen.getByText('/mnt/media/youtube/.arr-staging')).toBeInTheDocument();
    expect(screen.getByText(/must be able to see that folder/)).toBeInTheDocument();
    expect(screen.queryByText(IN_YOUTARR)).not.toBeInTheDocument();
  });

  test('still explains the folder when the downloads folder is unknown', () => {
    setup({ hostFolder: null });

    expect(screen.getByText(/folder inside your downloads folder/)).toBeInTheDocument();
  });

  test('says when an app can see the folder, without telling the user to change anything', () => {
    setup();

    expect(checkOf('Sonarr').getByText('Sonarr can see the folder.')).toBeInTheDocument();
    expect(checkOf('Radarr').getByText('Radarr can see the folder.')).toBeInTheDocument();
    expect(screen.queryByText(/volumes/)).not.toBeInTheDocument();
  });

  describe('an app that cannot see the folder', () => {
    test('is told apart from the one that can, with the path that was asked about', () => {
      setup({ checks: { sonarr: NOT_SEEN, radarr: SEEN } });

      expect(checkOf('Sonarr').getByText(/Sonarr cannot see the folder/)).toBeInTheDocument();
      expect(checkOf('Sonarr').getByText(IN_YOUTARR)).toBeInTheDocument();
      expect(checkOf('Radarr').getByText('Radarr can see the folder.')).toBeInTheDocument();
    });

    test('gets both ways to fix it, the volume to add and the other path to enter', () => {
      setup({ checks: { sonarr: NOT_SEEN, radarr: SEEN } });

      expect(checkOf('Sonarr').getByText(`/mnt/media/youtube/.arr-staging:${IN_YOUTARR}`)).toBeInTheDocument();
      expect(checkOf('Sonarr').getByText(/already sees that folder under another path/)).toBeInTheDocument();
      expect(checkOf('Sonarr').getByText(/does not follow a Remote Path Mapping/)).toBeInTheDocument();
    });

    test('opens the other-path field', () => {
      setup({ checks: { sonarr: NOT_SEEN, radarr: SEEN } });

      expect(screen.getByLabelText(PATH_FIELD)).toBeInTheDocument();
    });

    test('without a known downloads folder the volume is described in words', () => {
      setup({ hostFolder: null, checks: { sonarr: NOT_SEEN } });

      expect(checkOf('Sonarr').getByText(/mount that folder into Sonarr at/)).toBeInTheDocument();
    });
  });

  test('says why an app could not be asked', () => {
    setup({ checks: { sonarr: { ok: false, message: 'Sonarr rejected the API key.' }, radarr: SEEN } });

    expect(checkOf('Sonarr').getByText(/Could not ask Sonarr\. Sonarr rejected the API key\./)).toBeInTheDocument();
  });

  test('an app that is not connected points at the connection step', () => {
    setup({ connected: { sonarr: true, radarr: false }, checks: { sonarr: SEEN } });

    expect(checkOf('Radarr').getByText(/Connect Radarr in step 3/)).toBeInTheDocument();
  });

  test('says that it is checking', () => {
    setup({ checks: {}, checking: true });

    expect(checkOf('Sonarr').getByText('Asking Sonarr...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDisabled();
  });

  test('checks again when asked', () => {
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    expect(props.onRecheck).toHaveBeenCalledTimes(1);
  });

  test('nothing to check again without a connection', () => {
    setup({ connected: { sonarr: false, radarr: false }, checks: {} });

    expect(screen.getByRole('button', { name: 'Check again' })).toBeDisabled();
  });

  describe('the path inside Sonarr and Radarr', () => {
    test('stays folded away while both apps see the folder and none is set', () => {
      setup();

      expect(screen.getByRole('button', { name: DIFFERENT_PATH })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText(PATH_FIELD)).not.toBeInTheDocument();
    });

    test('opens on request and reports what is typed', () => {
      const props = setup();

      fireEvent.click(screen.getByRole('button', { name: DIFFERENT_PATH }));
      fireEvent.change(screen.getByLabelText(PATH_FIELD), { target: { value: '/downloads/youtarr' } });

      expect(props.onStagingPathChange).toHaveBeenCalledWith('/downloads/youtarr');
    });

    test('is open from the start when a path is set', () => {
      setup({ stagingPath: '/downloads/youtarr' });

      expect(screen.getByLabelText(PATH_FIELD)).toHaveValue('/downloads/youtarr');
    });

    test('says that a changed path is checked after saving', () => {
      setup({ stagingPath: '/downloads/youtarr', stagingPathSaved: false });

      expect(screen.getByText(/Save to check this path/)).toBeInTheDocument();
    });
  });

  test('how long an unimported file is kept is named for what it does', () => {
    const props = setup();

    fireEvent.change(screen.getByLabelText('Remove files nobody imported after (days)'), { target: { value: '14' } });

    expect(props.onRetentionDaysChange).toHaveBeenCalledWith(14);
  });
});
