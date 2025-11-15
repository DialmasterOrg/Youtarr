import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AdvancedSettingsSection } from '../AdvancedSettingsSection';
import { renderWithProviders } from '../../../../test-utils';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { ConfigState } from '../../types';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const setup = (
  overrides: Partial<React.ComponentProps<typeof AdvancedSettingsSection>> = {}
) => {
  const user = userEvent.setup();
  const props: React.ComponentProps<typeof AdvancedSettingsSection> = {
    config: createConfig(),
    onConfigChange: jest.fn(),
    onMobileTooltipClick: jest.fn(),
    ...overrides,
  };

  renderWithProviders(<AdvancedSettingsSection {...props} />);
  return { user, props };
};

const expandAccordion = async (user: ReturnType<typeof userEvent.setup>) => {
  const toggle = screen.getByRole('button', { name: /advanced settings/i });
  await user.click(toggle);
};

describe('AdvancedSettingsSection', () => {
  test('renders informational alert content when expanded', async () => {
    const { user } = setup();
    await expandAccordion(user);

    expect(screen.getByText('Advanced Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Fine-tune yt-dlp behavior/i)).toBeInTheDocument();
  });

  test('updates sleep delay when a value within range is entered', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();

    const ControlledSection: React.FC = () => {
      const [config, setConfig] = React.useState(createConfig());

      const handleConfigChange = (updates: Partial<ConfigState>) => {
        setConfig((prev) => ({ ...prev, ...updates }));
        onConfigChange(updates);
      };

      return (
        <AdvancedSettingsSection
          config={config}
          onConfigChange={handleConfigChange}
          onMobileTooltipClick={jest.fn()}
        />
      );
    };

    renderWithProviders(<ControlledSection />);
    await expandAccordion(user);

    const sleepInput = screen.getByLabelText(/sleep between requests/i);
    await user.type(sleepInput, '{selectall}{backspace}5');

    expect(onConfigChange).toHaveBeenLastCalledWith({ sleepRequests: 5 });
  });

  test('ignores sleep values outside of the allowed range', async () => {
    const onConfigChange = jest.fn();
    const { user } = setup({ onConfigChange });
    await expandAccordion(user);

    const sleepInput = screen.getByLabelText(/sleep between requests/i);
    await user.type(sleepInput, '{selectall}-1');

    expect(onConfigChange).not.toHaveBeenCalledWith({ sleepRequests: -1 });
  });

  test('validates proxy URL on blur and shows the returned error message', async () => {
    const { user } = setup({
      config: createConfig({ proxy: 'invalid-proxy' }),
    });
    await expandAccordion(user);

    const proxyInput = screen.getByLabelText(/proxy url/i);
    await user.click(proxyInput);
    await user.tab();

    expect(
      await screen.findByText(/invalid proxy url format/i)
    ).toBeInTheDocument();
  });

  test('clears proxy validation errors while editing and propagates text changes', async () => {
    const onConfigChange = jest.fn();
    const { user } = setup({
      config: createConfig({ proxy: 'invalid-proxy' }),
      onConfigChange,
    });
    await expandAccordion(user);

    const proxyInput = screen.getByLabelText(/proxy url/i);
    await user.click(proxyInput);
    await user.tab();
    expect(
      await screen.findByText(/invalid proxy url format/i)
    ).toBeInTheDocument();

    await user.click(proxyInput);
    await user.type(proxyInput, '1');

    await waitFor(() => {
      expect(
        screen.queryByText(/invalid proxy url format/i)
      ).not.toBeInTheDocument();
    });
    expect(onConfigChange).toHaveBeenLastCalledWith({
      proxy: 'invalid-proxy1',
    });
  });
});
