import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { InfoTooltip } from '../InfoTooltip';

describe('InfoTooltip', () => {
  test('renders an info button with a default name', () => {
    render(<InfoTooltip text="Helpful information" />);

    expect(screen.getByRole('button', { name: 'More information' })).toBeInTheDocument();
  });

  test('takes its own name for assistive tech', () => {
    render(<InfoTooltip label="About sync" text="Syncs the playlist to your servers." />);

    expect(screen.getByRole('button', { name: 'About sync' })).toBeInTheDocument();
  });

  test('does not show the text until hovered', () => {
    render(<InfoTooltip text="Helpful information" />);

    expect(screen.queryByText('Helpful information')).not.toBeInTheDocument();
  });

  test('shows the text on hover', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip text={<span>Syncs the playlist to your servers.</span>} />);

    await user.hover(screen.getByRole('button', { name: 'More information' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Syncs the playlist to your servers.');
  });

  test('a click does not reach the control it sits beside', async () => {
    const user = userEvent.setup();
    const onParentClick = jest.fn();
    render(
      <div onClick={onParentClick}>
        <InfoTooltip text="Helpful information" />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'More information' }));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  describe('on a touch screen', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    test('shows the text on tap', async () => {
      const user = userEvent.setup();
      render(<InfoTooltip text="Helpful information" />);

      await user.click(screen.getByRole('button', { name: 'More information' }));

      expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful information');
    });
  });
});
