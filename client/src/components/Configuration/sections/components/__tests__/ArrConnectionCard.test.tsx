import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrConnectionCard } from '../ArrConnectionCard';
import { renderWithProviders } from '../../../../../test-utils';
import { ArrConnectionResult } from '../../../utils/arrBridgeSetup';

const KEY = '5p1ke0000000000000000000000000ab';
const SAVED = { url: 'http://sonarr:8989', keySet: true };
const EMPTY = { url: null, keySet: false };
const OK: ArrConnectionResult = { ok: true, appName: 'Sonarr', version: '4.0.20.3014', connection: SAVED };
const UNREACHABLE: ArrConnectionResult = {
  ok: false, reason: 'unreachable', message: 'Could not reach Sonarr at that address.',
};

const setup = (overrides: Partial<React.ComponentProps<typeof ArrConnectionCard>> = {}) => {
  const props: React.ComponentProps<typeof ArrConnectionCard> = {
    app: 'sonarr',
    connection: EMPTY,
    busy: false,
    onSave: jest.fn().mockResolvedValue(OK),
    onTest: jest.fn().mockResolvedValue({ ok: true, appName: 'Sonarr', version: '4.0.20.3014' }),
    onRemove: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  renderWithProviders(<ArrConnectionCard {...props} />);
  return props;
};

const addressField = () => screen.getByLabelText('Sonarr address');
const keyField = () => screen.getByLabelText('Sonarr API key');
const saveButton = () => screen.getByRole('button', { name: 'Test and save' });
const testButton = () => screen.getByRole('button', { name: 'Test saved connection' });
const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

describe('ArrConnectionCard', () => {
  test('Test and save is off until an address and a key are typed', () => {
    setup();

    expect(saveButton()).toBeDisabled();
    type(addressField(), 'http://sonarr:8989');
    expect(saveButton()).toBeDisabled();
    type(keyField(), KEY);
    expect(saveButton()).toBeEnabled();
  });

  test('saving sends the typed address and key and shows the app and its version', async () => {
    const props = setup();

    type(addressField(), ' http://sonarr:8989/ ');
    type(keyField(), ` ${KEY} `);
    fireEvent.click(saveButton());

    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith('http://sonarr:8989/', KEY));
    expect(await screen.findByText('Connected to Sonarr 4.0.20.3014.')).toBeInTheDocument();
    expect(addressField()).toHaveValue('http://sonarr:8989');
  });

  test('a failed attempt shows the reason and keeps both fields', async () => {
    setup({ onSave: jest.fn().mockResolvedValue(UNREACHABLE) });

    type(addressField(), 'https://localhost:8989');
    type(keyField(), KEY);
    fireEvent.click(saveButton());

    expect(await screen.findByText('Could not reach Sonarr at that address.')).toBeInTheDocument();
    expect(addressField()).toHaveValue('https://localhost:8989');
    expect(keyField()).toHaveValue(KEY);
  });

  // A mistyped address is corrected without typing the key again.
  test('after a failed attempt, changing only the address sends the same typed key again', async () => {
    const onSave = jest.fn().mockResolvedValueOnce(UNREACHABLE).mockResolvedValueOnce(OK);
    setup({ onSave });

    type(addressField(), 'https://localhost:8989');
    type(keyField(), KEY);
    fireEvent.click(saveButton());
    await screen.findByText('Could not reach Sonarr at that address.');

    type(addressField(), 'http://192.168.1.20:8989');
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith('http://192.168.1.20:8989', KEY));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  test('after a successful save, changing only the address sends the typed key again', async () => {
    const onSave = jest.fn().mockResolvedValue(OK);
    setup({ onSave });

    type(addressField(), 'http://sonarr:8989');
    type(keyField(), KEY);
    fireEvent.click(saveButton());
    await screen.findByText('Connected to Sonarr 4.0.20.3014.');

    type(addressField(), 'http://192.168.1.20:8989');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith('http://192.168.1.20:8989', KEY));
  });

  // "Connected to Sonarr" beside an address that was never tested would mislead.
  test('editing the address or the key takes the earlier result away', async () => {
    setup();

    type(addressField(), 'http://sonarr:8989');
    type(keyField(), KEY);
    fireEvent.click(saveButton());
    await screen.findByText('Connected to Sonarr 4.0.20.3014.');

    type(addressField(), 'http://192.168.1.20:8989');

    expect(screen.queryByText('Connected to Sonarr 4.0.20.3014.')).not.toBeInTheDocument();
  });

  // The server never sends a stored key to a new address, and the page does
  // not hold a stored key, so a fresh page needs the key typed.
  test('a saved connection opened fresh asks for the key when the address changes, and disables Test', () => {
    setup({ connection: SAVED });

    expect(addressField()).toHaveValue('http://sonarr:8989');
    expect(testButton()).toBeEnabled();
    expect(screen.getByText('A key is saved. Type it again only to change the address or the key.')).toBeInTheDocument();

    type(addressField(), 'http://192.168.1.20:8989');

    expect(screen.getByText('Type the API key again. Youtarr never sends a saved key to a new address.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(testButton()).toBeDisabled();
  });

  test('the key field never shows a saved key', () => {
    setup({ connection: SAVED });

    expect(keyField()).toHaveValue('');
    expect(keyField()).toHaveAttribute('type', 'password');
  });

  test('Test shows the result for the saved connection', async () => {
    const props = setup({ connection: SAVED });

    fireEvent.click(testButton());

    await waitFor(() => expect(props.onTest).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Connected to Sonarr 4.0.20.3014.')).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  test('a failed test shows why', async () => {
    setup({
      connection: SAVED,
      onTest: jest.fn().mockResolvedValue({ ok: false, reason: 'unauthorized', message: 'Sonarr rejected the API key.' }),
    });

    fireEvent.click(testButton());

    expect(await screen.findByText('Sonarr rejected the API key.')).toBeInTheDocument();
  });

  test('Test is off without a saved connection, and there is nothing to remove', () => {
    setup();

    expect(testButton()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByText('Not set up')).toBeInTheDocument();
  });

  // The card knows a connection is stored, not that the app answers right
  // now: "Connected" stayed up while every test of it failed.
  test('describes a stored connection as saved, not as connected', () => {
    setup({ connection: SAVED });

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  test('Remove clears the card', async () => {
    const props = setup({ connection: SAVED });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(props.onRemove).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(addressField()).toHaveValue(''));
  });

  test('a removal that fails says so and keeps the address', async () => {
    setup({ connection: SAVED, onRemove: jest.fn().mockResolvedValue(false) });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Could not remove the Sonarr connection.')).toBeInTheDocument();
    expect(addressField()).toHaveValue('http://sonarr:8989');
  });

  test('every button is off while the connection is busy', () => {
    setup({ connection: SAVED, busy: true });

    type(keyField(), KEY);

    expect(saveButton()).toBeDisabled();
    expect(testButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  test('names Radarr in its own card', () => {
    setup({ app: 'radarr' });

    expect(screen.getByLabelText('Radarr address')).toHaveAttribute('placeholder', 'http://radarr:7878');
    expect(screen.getByLabelText('Radarr API key')).toBeInTheDocument();
  });
});
