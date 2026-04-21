import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VideosFilters from '../VideosFilters';

describe('VideosFilters', () => {
  const baseProps: React.ComponentProps<typeof VideosFilters> = {
    isMobile: false,
    showSortControls: true,
    channelFilter: '',
    uniqueChannels: ['Tech Channel', 'Gaming Channel'],
    dateFrom: '',
    dateTo: '',
    maxRatingFilter: '',
    protectedFilter: false,
    orderBy: 'added',
    sortOrder: 'desc',
    onChannelFilterChange: jest.fn(),
    onDateFromChange: jest.fn(),
    onDateToChange: jest.fn(),
    onClearDates: jest.fn(),
    onMaxRatingChange: jest.fn(),
    onProtectedFilterChange: jest.fn(),
    onSortChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders sort buttons when showSortControls is true', () => {
    render(<VideosFilters {...baseProps} />);
    expect(screen.getByRole('button', { name: /Published/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Downloaded/ })).toBeInTheDocument();
  });

  test('hides sort buttons when showSortControls is false', () => {
    render(<VideosFilters {...baseProps} showSortControls={false} />);
    expect(screen.queryByRole('button', { name: /Published/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Downloaded/ })).not.toBeInTheDocument();
  });

  test('clicking the Published sort button fires onSortChange', () => {
    render(<VideosFilters {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Published/ }));
    expect(baseProps.onSortChange).toHaveBeenCalledWith('published');
  });

  test('clicking the channel filter button opens the menu with available channels', () => {
    render(<VideosFilters {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Filter by Channel/ }));
    expect(screen.getByTestId('filter-menu-Tech Channel')).toBeInTheDocument();
    expect(screen.getByTestId('filter-menu-Gaming Channel')).toBeInTheDocument();
  });

  test('toggling the Protected chip fires onProtectedFilterChange with true', () => {
    render(<VideosFilters {...baseProps} />);
    const chip = screen.getByText('Protected');
    fireEvent.click(chip);
    expect(baseProps.onProtectedFilterChange).toHaveBeenCalledWith(true);
  });

  test('mobile layout hides the date inputs and shows the mobile protected chip', () => {
    render(<VideosFilters {...baseProps} isMobile />);
    expect(screen.queryByLabelText('From Date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To Date')).not.toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });
});
