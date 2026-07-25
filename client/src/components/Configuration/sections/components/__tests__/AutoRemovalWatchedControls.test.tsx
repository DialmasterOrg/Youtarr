import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AutoRemovalWatchedControls } from '../AutoRemovalWatchedControls';
import { renderWithProviders } from '../../../../../test-utils';
import { ConfigState } from '../../../types';
import { DEFAULT_CONFIG } from '../../../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

describe('AutoRemovalWatchedControls', () => {
  test('toggles watched-based removal', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();
    renderWithProviders(
      <AutoRemovalWatchedControls
        config={createConfig()}
        onConfigChange={onConfigChange}
      />
    );

    const toggle = screen.getByRole('checkbox', { name: /Remove watched videos/i });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(onConfigChange).toHaveBeenCalledWith({ autoRemovalWatchedEnabled: true });
  });

  test('hides the watched threshold selects when disabled', () => {
    renderWithProviders(
      <AutoRemovalWatchedControls
        config={createConfig()}
        onConfigChange={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('Wait after last watch')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Minimum time since download')).not.toBeInTheDocument();
  });

  test('selects the days-since-watched threshold', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();
    renderWithProviders(
      <AutoRemovalWatchedControls
        config={createConfig({ autoRemovalWatchedEnabled: true })}
        onConfigChange={onConfigChange}
      />
    );

    const select = screen.getByLabelText('Wait after last watch');
    fireEvent.mouseDown(select);
    const option = await screen.findByRole('option', { name: '7 days' });
    await user.click(option);

    expect(onConfigChange).toHaveBeenCalledWith({ autoRemovalWatchedMinDaysSinceWatched: '7' });
  });

  test('selects the minimum video age threshold', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();
    renderWithProviders(
      <AutoRemovalWatchedControls
        config={createConfig({ autoRemovalWatchedEnabled: true })}
        onConfigChange={onConfigChange}
      />
    );

    const select = screen.getByLabelText('Minimum time since download');
    fireEvent.mouseDown(select);
    const option = await screen.findByRole('option', { name: '30 days' });
    await user.click(option);

    expect(onConfigChange).toHaveBeenCalledWith({ autoRemovalWatchedMinVideoAgeDays: '30' });
  });

  test('warns when watch status sync is disabled', () => {
    renderWithProviders(
      <AutoRemovalWatchedControls
        config={createConfig({
          autoRemovalWatchedEnabled: true,
          watchStatusSyncEnabled: false,
        })}
        onConfigChange={jest.fn()}
      />
    );

    expect(screen.getByText(/Watch status sync is disabled/i)).toBeInTheDocument();
  });

  test('does not warn when watch status sync is enabled', () => {
    renderWithProviders(
      <AutoRemovalWatchedControls
        config={createConfig({ autoRemovalWatchedEnabled: true })}
        onConfigChange={jest.fn()}
      />
    );

    expect(screen.queryByText(/Watch status sync is disabled/i)).not.toBeInTheDocument();
  });
});
