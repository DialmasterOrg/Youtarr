import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeSetupValues } from '../ArrBridgeSetupValues';
import { renderWithProviders } from '../../../../../test-utils';

const KEY = 'a'.repeat(64);
const INDEXER_URL = `${window.location.protocol}//${window.location.hostname}${
  window.location.port ? `:${window.location.port}` : ''
}/arr/newznab`;

const setup = (overrides: Partial<React.ComponentProps<typeof ArrBridgeSetupValues>> = {}) => {
  const props: React.ComponentProps<typeof ArrBridgeSetupValues> = {
    bridgeKey: KEY,
    loading: false,
    error: null,
    regenerating: false,
    onRegenerate: jest.fn().mockResolvedValue(true),
    categories: [{ name: 'tv', subfolder: null }, { name: 'movies', subfolder: null }],
    saved: true,
    resolution: 1080,
    setSnackbar: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeSetupValues {...props} />);
  return props;
};

const IN_DOCKER = 'In Docker, on the same network as Youtarr';
const ELSEWHERE = 'Somewhere else';
const chooseElsewhere = () => fireEvent.click(screen.getByRole('radio', { name: ELSEWHERE }));

describe('ArrBridgeSetupValues', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });

  describe('where Sonarr and Radarr run', () => {
    test('starts with Docker on Youtarr\'s network, where the address is the container\'s name and port', () => {
      setup();

      expect(screen.getByRole('radio', { name: IN_DOCKER })).toBeChecked();
      const sonarr = within(screen.getByRole('group', { name: 'In Sonarr' }));
      expect(sonarr.getByText('http://youtarr:3011/arr/newznab')).toBeInTheDocument();
      expect(sonarr.getByText('youtarr')).toBeInTheDocument();
      expect(sonarr.getByText('3011')).toBeInTheDocument();
      expect(screen.getByText(/is the name of Youtarr's container/)).toBeInTheDocument();
    });

    test('somewhere else uses the address this page is open at', () => {
      setup();

      chooseElsewhere();

      expect(screen.getByRole('radio', { name: ELSEWHERE })).toBeChecked();
      const sonarr = within(screen.getByRole('group', { name: 'In Sonarr' }));
      expect(sonarr.getByText(INDEXER_URL)).toBeInTheDocument();
      expect(sonarr.getByText(window.location.hostname)).toBeInTheDocument();
      expect(sonarr.queryByText('youtarr')).not.toBeInTheDocument();
      expect(screen.getByText(/the address this page is open at/)).toBeInTheDocument();
    });
  });

  test('shows the key and the values to type into Sonarr', () => {
    setup();

    expect(screen.getByLabelText('API key')).toHaveValue(KEY);
    const sonarr = within(screen.getByRole('group', { name: 'In Sonarr' }));
    expect(sonarr.getByText('/api')).toBeInTheDocument();
    expect(sonarr.getByText('/arr/sabnzbd')).toBeInTheDocument();
    expect(sonarr.getByText('tv')).toBeInTheDocument();
    expect(sonarr.getByText('No')).toBeInTheDocument();
  });

  test('says which quality the profile must allow, and to press Test', () => {
    setup({ resolution: 720 });

    expect(
      screen.getByText(/must allow WEBDL at the resolution a video really has, because Youtarr labels each release with it\. The highest label is currently 720p: it follows/)
    ).toBeInTheDocument();
    expect(screen.getByText(/press Test on both/)).toBeInTheDocument();
  });

  test('names the two settings the highest label follows, set apart from the sentence', () => {
    setup({ resolution: 720 });

    expect(screen.getByText('Resolution', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Offer releases as', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/under Downloads below\./)).toBeInTheDocument();
  });

  test('gives Radarr the movies category', () => {
    setup();

    const radarr = within(screen.getByRole('group', { name: 'In Radarr' }));
    expect(radarr.getByText('movies')).toBeInTheDocument();
    expect(radarr.queryByText('tv')).not.toBeInTheDocument();
  });

  test('names the categories that exist when an app has lost its usual one', () => {
    setup({ categories: [{ name: 'tv-4k', subfolder: null }, { name: 'films', subfolder: null }] });

    const sonarr = within(screen.getByRole('group', { name: 'In Sonarr' }));
    expect(sonarr.getByText('tv-4k or films')).toBeInTheDocument();
  });

  test('says the values work after a save while the bridge is not saved as on', () => {
    setup({ saved: false });

    expect(screen.getByText('These values start working after you save.')).toBeInTheDocument();
  });

  test('copies the key and confirms', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(KEY));
    await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
      open: true, message: 'API key copied', severity: 'success',
    }));
  });

  test('copies the indexer URL for where the apps run', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Copy indexer URL' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://youtarr:3011/arr/newznab'));

    chooseElsewhere();
    fireEvent.click(screen.getByRole('button', { name: 'Copy indexer URL' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(INDEXER_URL));
  });

  test('explains what to do without a clipboard, which browsers hide on plain http', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));

    await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
      open: true,
      message: 'Your browser blocked copying. Select the text and copy it yourself.',
      severity: 'warning',
    }));
  });

  test('asks before replacing the key, then replaces it', async () => {
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Create new key' }));
    expect(props.onRegenerate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Replace key' }));

    await waitFor(() => expect(props.onRegenerate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
      open: true, message: 'Created a new key. Update it in Sonarr and Radarr.', severity: 'success',
    }));
  });

  test('cancelling keeps the key', async () => {
    const props = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Create new key' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(props.onRegenerate).not.toHaveBeenCalled();
  });

  test('reports a key that could not be replaced', async () => {
    const props = setup({ onRegenerate: jest.fn().mockResolvedValue(false) });

    fireEvent.click(screen.getByRole('button', { name: 'Create new key' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Replace key' }));

    await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
      open: true, message: 'Could not create a new key.', severity: 'error',
    }));
  });

  test('shows an error in place of the values when the key cannot be loaded', () => {
    setup({ bridgeKey: null, error: 'Could not load the key.' });

    expect(screen.getByText('Could not load the key.')).toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
  });

  test('says that the key is a secret and names the login proxy path, without raising an alarm', () => {
    setup();

    expect(screen.getByText(/treat it like a password/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('/arr/')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute(
      'href', 'https://dialmasterorg.github.io/Youtarr/docs/sonarr-radarr/'
    );
  });
});
