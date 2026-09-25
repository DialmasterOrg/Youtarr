import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutoRemovalUsageControls } from '../AutoRemovalUsageControls';
import { renderWithProviders } from '../../../../../test-utils';
import { ConfigState } from '../../../types';
import { DEFAULT_CONFIG } from '../../../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

describe('AutoRemovalUsageControls', () => {
  test('shows the configured total size limit', () => {
    renderWithProviders(
      <AutoRemovalUsageControls config={createConfig({ autoRemovalUsageLimit: '750GB' })} onConfigChange={jest.fn()} />
    );

    expect(screen.getByTestId('auto-removal-usage-limit-amount')).toHaveValue(750);
  });

  test('saves a typed limit as the total size limit', () => {
    const onConfigChange = jest.fn();
    renderWithProviders(<AutoRemovalUsageControls config={createConfig()} onConfigChange={onConfigChange} />);

    fireEvent.change(screen.getByTestId('auto-removal-usage-limit-amount'), { target: { value: '400' } });

    expect(onConfigChange).toHaveBeenCalledWith({ autoRemovalUsageLimit: '400GB' });
  });

  test('turns the rule off when the limit is cleared', () => {
    const onConfigChange = jest.fn();
    renderWithProviders(
      <AutoRemovalUsageControls config={createConfig({ autoRemovalUsageLimit: '750GB' })} onConfigChange={onConfigChange} />
    );

    fireEvent.change(screen.getByTestId('auto-removal-usage-limit-amount'), { target: { value: '' } });

    expect(onConfigChange).toHaveBeenCalledWith({ autoRemovalUsageLimit: '' });
  });
});
