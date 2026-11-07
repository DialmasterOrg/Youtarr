import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AvailabilityChip from '../AvailabilityChip';
import { renderWithProviders } from '../../../test-utils';

describe('AvailabilityChip', () => {
  test('renders Available for a present file', () => {
    renderWithProviders(<AvailabilityChip state="present" />);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });

  test('renders Missing for a file Youtarr could not find', () => {
    renderWithProviders(<AvailabilityChip state="missing" />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });

  test('shows the same crossed-out cloud for Missing as the status chips elsewhere', () => {
    renderWithProviders(<AvailabilityChip state="missing" />);
    expect(screen.getByTestId('CloudOffIcon')).toBeInTheDocument();
  });

  describe('on a touch screen', () => {
    const originalMatchMedia = window.matchMedia;
    const pointerIs = (coarse: boolean) => {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: coarse && query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    };
    const renderInRow = (onRowClick: jest.Mock) => renderWithProviders(
      <div onClick={onRowClick}>
        <AvailabilityChip state="missing" tooltip="Youtarr expected a file and could not find it." />
      </div>
    );

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    test('keeps a tap from reaching the row, so the tap shows the reason', async () => {
      pointerIs(true);
      const user = userEvent.setup();
      const onRowClick = jest.fn();
      renderInRow(onRowClick);

      await user.pointer({ keys: '[TouchA]', target: screen.getByText('Missing') });

      expect(onRowClick).not.toHaveBeenCalled();
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Youtarr expected a file and could not find it.');
    });

    // A laptop with a touchscreen reports a fine pointer; there the tooltip
    // does not open on tap, so the tap must keep working on the row.
    test('lets a tap through to the row where the device reports a fine pointer', async () => {
      pointerIs(false);
      const user = userEvent.setup();
      const onRowClick = jest.fn();
      renderInRow(onRowClick);

      await user.pointer({ keys: '[TouchA]', target: screen.getByText('Missing') });

      expect(onRowClick).toHaveBeenCalledTimes(1);
    });
  });

  test('lets a mouse click through to the row, which may expand on click', async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    renderWithProviders(
      <div onClick={onRowClick}>
        <AvailabilityChip state="missing" tooltip="Youtarr expected a file and could not find it." />
      </div>
    );

    await user.click(screen.getByText('Missing'));

    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  test('renders Deleted for a file Youtarr removed', () => {
    renderWithProviders(<AvailabilityChip state="deleted" />);
    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.getByTestId('DeletedChipIcon')).toBeInTheDocument();
  });

  test('explains the removal in its tooltip', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AvailabilityChip state="deleted" tooltip="Deleted by automatic cleanup on 10/3/2026 (older than 30 days)." />
    );

    await user.hover(screen.getByText('Deleted'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Deleted by automatic cleanup on 10/3/2026 (older than 30 days).');
  });

  test('shows a formatted explanation in its tooltip', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AvailabilityChip state="missing" tooltip={<>Youtarr expected a file at: <code>/d/v.mp4</code></>} />
    );

    await user.hover(screen.getByText('Missing'));

    expect(within(await screen.findByRole('tooltip')).getByRole('code')).toHaveTextContent('/d/v.mp4');
  });

  test('takes a label override for summary counts', () => {
    renderWithProviders(<AvailabilityChip state="missing" label="2 missing" />);
    expect(screen.getByText('2 missing')).toBeInTheDocument();
  });

  test('renders with compact styling when compact prop is true', () => {
    renderWithProviders(<AvailabilityChip state="present" compact />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });
});
