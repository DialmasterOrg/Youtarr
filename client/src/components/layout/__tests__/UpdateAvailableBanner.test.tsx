import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpdateAvailableBanner, {
  DISMISSED_VERSION_STORAGE_KEY,
} from '../UpdateAvailableBanner';

const SLIDE_TRANSITION_MS = 300;

const flushSlideExit = () => {
  act(() => {
    jest.advanceTimersByTime(SLIDE_TRANSITION_MS);
  });
};

describe('UpdateAvailableBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test('renders the server version and update message when show is true', () => {
    render(<UpdateAvailableBanner show serverVersion="v1.70.0" />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Youtarr v1.70.0');
    expect(banner).toHaveTextContent('Pull the latest image to update.');
  });

  test('renders a generic message when serverVersion is not provided', () => {
    render(<UpdateAvailableBanner show />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'A new Youtarr version is available.'
    );
  });

  test('does not render when show is false', () => {
    render(<UpdateAvailableBanner show={false} serverVersion="v1.70.0" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('does not render when the current serverVersion was previously dismissed', () => {
    window.localStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, 'v1.70.0');

    render(<UpdateAvailableBanner show serverVersion="v1.70.0" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('renders again when a newer serverVersion differs from the dismissed one', () => {
    window.localStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, 'v1.70.0');

    render(<UpdateAvailableBanner show serverVersion="v1.71.0" />);

    expect(screen.getByRole('status')).toHaveTextContent('Youtarr v1.71.0');
  });

  test('clicking close persists the current version and hides the banner', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<UpdateAvailableBanner show serverVersion="v1.70.0" />);

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(window.localStorage.getItem(DISMISSED_VERSION_STORAGE_KEY)).toBe('v1.70.0');

    flushSlideExit();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('re-reads dismissed version when serverVersion changes', () => {
    const { rerender } = render(
      <UpdateAvailableBanner show serverVersion="v1.70.0" />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();

    window.localStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, 'v1.71.0');
    rerender(<UpdateAvailableBanner show serverVersion="v1.71.0" />);

    flushSlideExit();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('dismissal does not hide banner for a subsequent different version', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const { rerender } = render(
      <UpdateAvailableBanner show serverVersion="v1.70.0" />
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    flushSlideExit();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<UpdateAvailableBanner show serverVersion="v1.71.0" />);

    expect(screen.getByRole('status')).toHaveTextContent('Youtarr v1.71.0');
  });
});
