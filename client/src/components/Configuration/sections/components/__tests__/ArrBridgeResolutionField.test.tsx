import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ArrBridgeResolutionField } from '../ArrBridgeResolutionField';
import { renderWithProviders } from '../../../../../test-utils';

const setup = (overrides: Partial<React.ComponentProps<typeof ArrBridgeResolutionField>> = {}) => {
  const props: React.ComponentProps<typeof ArrBridgeResolutionField> = {
    resolution: '',
    labelLimit: '',
    preferredResolution: '480',
    onChange: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeResolutionField {...props} />);
  return props;
};

const select = () => screen.getByRole('button', { name: 'Resolution' });
const labelSelect = () => screen.getByRole('button', { name: 'Offer releases as' });

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

    expect(props.onChange).toHaveBeenCalledWith({ arrBridgeResolution: '1080' });
  });

  test('going back to the preferred resolution reports an empty setting', async () => {
    const user = userEvent.setup();
    const props = setup({ resolution: '1080' });
    expect(select()).toHaveTextContent('1080p');

    await user.click(select());
    await user.click(await screen.findByRole('option', { name: 'Same as Preferred Resolution (480p)' }));

    expect(props.onChange).toHaveBeenCalledWith({ arrBridgeResolution: '' });
  });

  describe('the label limit', () => {
    test('shows both stored values', () => {
      setup({ resolution: '1080', labelLimit: '480' });

      expect(select()).toHaveTextContent('1080p');
      expect(labelSelect()).toHaveTextContent('480p at most');
    });

    test('labels releases with their real resolution until a limit is chosen', () => {
      setup();

      expect(labelSelect()).toHaveTextContent('Their real resolution');
    });

    test('offers no limit and the three lower labels', async () => {
      const user = userEvent.setup();
      setup();

      await user.click(labelSelect());

      expect(await screen.findByRole('option', { name: 'Their real resolution' })).toBeInTheDocument();
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Their real resolution', '1080p at most', '720p at most', '480p at most',
      ]);
    });

    test('says the download resolution stays and the apps read the real quality at import', () => {
      setup();

      expect(
        screen.getByText(
          'Sonarr and Radarr prefer a higher resolution. A lower label makes them pick Youtarr only when nothing '
          + 'better is offered. The video is still downloaded at the resolution above, and they read its real '
          + 'quality when they import it.'
        )
      ).toBeInTheDocument();
    });

    test('choosing a limit reports it', async () => {
      const user = userEvent.setup();
      const props = setup();

      await user.click(labelSelect());
      await user.click(await screen.findByRole('option', { name: '720p at most' }));

      expect(props.onChange).toHaveBeenCalledWith({ arrBridgeLabelLimit: '720' });
    });

    test('going back to the real resolution reports an empty setting', async () => {
      const user = userEvent.setup();
      const props = setup({ labelLimit: '720' });

      await user.click(labelSelect());
      await user.click(await screen.findByRole('option', { name: 'Their real resolution' }));

      expect(props.onChange).toHaveBeenCalledWith({ arrBridgeLabelLimit: '' });
    });
  });
});
