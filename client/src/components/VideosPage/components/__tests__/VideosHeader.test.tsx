import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VideosHeader from '../VideosHeader';

describe('VideosHeader', () => {
  const renderHeader = (overrides: Partial<React.ComponentProps<typeof VideosHeader>> = {}) => {
    const handlers = {
      onViewModeChange: jest.fn(),
      onSearchChange: jest.fn(),
    };
    render(
      <VideosHeader
        totalVideos={42}
        isMobile={false}
        viewMode="grid"
        {...handlers}
        {...overrides}
      />
    );
    return handlers;
  };

  test('shows the library total in the heading', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: /Library \(42 total\)/ })).toBeInTheDocument();
  });

  test('renders Table and Grid view toggle buttons and reports active via aria-pressed', () => {
    renderHeader({ viewMode: 'table' });
    const tableBtn = screen.getByRole('button', { name: 'Table View' });
    const gridBtn = screen.getByRole('button', { name: 'Grid View' });
    expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
    expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking the other view button fires onViewModeChange', () => {
    const { onViewModeChange } = renderHeader({ viewMode: 'grid' });
    fireEvent.click(screen.getByRole('button', { name: 'Table View' }));
    expect(onViewModeChange).toHaveBeenCalledWith('table');
  });

  test('typing in the search box invokes onSearchChange', () => {
    const { onSearchChange } = renderHeader();
    const input = screen.getByPlaceholderText(/Search videos/i);
    fireEvent.change(input, { target: { value: 'foo' } });
    expect(onSearchChange).toHaveBeenCalledWith('foo');
  });
});
