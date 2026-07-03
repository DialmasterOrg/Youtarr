import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { DownloadActivityIndicator } from '../DownloadActivityIndicator';
import { TooltipProvider } from '../../ui/tooltip';
import { useActiveDownloads } from '../../../hooks/useActiveDownloads';

jest.mock('../../../hooks/useActiveDownloads', () => ({
  useActiveDownloads: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockUseActiveDownloads = useActiveDownloads as jest.Mock;

function renderIndicator(token: string | null = 'test-token') {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <DownloadActivityIndicator token={token} />
      </TooltipProvider>
    </MemoryRouter>
  );
}

describe('DownloadActivityIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when no downloads are active', () => {
    mockUseActiveDownloads.mockReturnValue({ active: false });

    renderIndicator();

    expect(
      screen.queryByRole('button', { name: /downloads.*in progress/i })
    ).not.toBeInTheDocument();
  });

  test('shows the indicator button when downloads are active', () => {
    mockUseActiveDownloads.mockReturnValue({ active: true });

    renderIndicator();

    expect(
      screen.getByRole('button', { name: /downloads.*in progress/i })
    ).toBeInTheDocument();
  });

  test('passes the token through to the hook', () => {
    mockUseActiveDownloads.mockReturnValue({ active: false });

    renderIndicator('abc-123');

    expect(mockUseActiveDownloads).toHaveBeenCalledWith('abc-123');
  });

  test('navigates to the downloads activity page when clicked', async () => {
    mockUseActiveDownloads.mockReturnValue({ active: true });
    const user = userEvent.setup();

    renderIndicator();

    await user.click(
      screen.getByRole('button', { name: /downloads.*in progress/i })
    );

    expect(mockNavigate).toHaveBeenCalledWith('/downloads/activity');
  });

  test('keeps both animations running regardless of reduced-motion preferences', () => {
    mockUseActiveDownloads.mockReturnValue({ active: true });

    renderIndicator();

    const spinner = screen.getByTestId('download-activity-spinner');
    const arrow = screen.getByTestId('download-activity-arrow');
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).not.toHaveClass('motion-reduce:animate-none');
    expect(arrow).toHaveClass('animate-download-arrow-drop');
  });

  test('shows an explanatory tooltip on hover', async () => {
    mockUseActiveDownloads.mockReturnValue({ active: true });
    const user = userEvent.setup();

    renderIndicator();

    await user.hover(
      screen.getByRole('button', { name: /downloads.*in progress/i })
    );

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/video downloads are in progress/i);
  });
});
