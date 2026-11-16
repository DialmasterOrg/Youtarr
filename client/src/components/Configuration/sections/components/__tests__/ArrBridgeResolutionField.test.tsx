import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ArrBridgeResolutionField } from '../ArrBridgeResolutionField';
import { renderWithProviders } from '../../../../../test-utils';

const setup = (overrides: Partial<React.ComponentProps<typeof ArrBridgeResolutionField>> = {}) => {
  const props: React.ComponentProps<typeof ArrBridgeResolutionField> = {
    value: '',
    preferredResolution: '480',
    onChange: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeResolutionField {...props} />);
  return props;
};

const select = () => screen.getByRole('button', { name: 'Resolution' });

describe('ArrBridgeResolutionField', () => {
  test('follows the preferred resolution until one is chosen, and names it', () => {
    setup({ preferredResolution: '720' });

    expect(select()).toHaveTextContent('Same as Preferred Resolution (720p)');
  });

  test('says that it is a ceiling, not a promise', () => {
    setup();

    expect(screen.getByText(/best quality up to this resolution/)).toBeInTheDocument();
    expect(screen.getByText(/only exists in a lower resolution downloads at that/)).toBeInTheDocument();
  });

  test('offers the resolutions Sonarr and Radarr have a quality for', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(select());

    expect(await screen.findByRole('option', { name: '4K (2160p)' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Same as Preferred Resolution (480p)', '4K (2160p)', '1080p', '720p', '480p',
    ]);
  });

  test('choosing one reports it', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(select());
    await user.click(await screen.findByRole('option', { name: '1080p' }));

    expect(props.onChange).toHaveBeenCalledWith('1080');
  });

  test('going back to the preferred resolution reports an empty setting', async () => {
    const user = userEvent.setup();
    const props = setup({ value: '1080' });
    expect(select()).toHaveTextContent('1080p');

    await user.click(select());
    await user.click(await screen.findByRole('option', { name: 'Same as Preferred Resolution (480p)' }));

    expect(props.onChange).toHaveBeenCalledWith('');
  });
});
