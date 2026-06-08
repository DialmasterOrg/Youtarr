import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AutoDownloadChip from '../AutoDownloadChip';

describe('AutoDownloadChip', () => {
  test('renders an unpressed chip when auto-download is off', () => {
    render(<AutoDownloadChip enabled={false} onToggle={jest.fn()} />);

    const chip = screen.getByRole('button', { name: 'Auto-download' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  test('renders a pressed chip when auto-download is on', () => {
    render(<AutoDownloadChip enabled onToggle={jest.fn()} />);

    const chip = screen.getByRole('button', { name: 'Auto-download' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  test('toggles to the opposite state on click', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    render(<AutoDownloadChip enabled={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'Auto-download' }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  test('is not clickable when disabled', () => {
    render(<AutoDownloadChip enabled={false} onToggle={jest.fn()} disabled />);

    expect(screen.queryByRole('button', { name: 'Auto-download' })).not.toBeInTheDocument();
    expect(screen.getByText('Auto-download')).toBeInTheDocument();
  });
});
