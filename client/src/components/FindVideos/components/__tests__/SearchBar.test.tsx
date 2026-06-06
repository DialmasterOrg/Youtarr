import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from '../SearchBar';

const baseProps = {
  query: '',
  pageSize: 25 as const,
  minDuration: 0 as const,
  loading: false,
  viewMode: 'grid' as const,
  onQueryChange: () => {},
  onPageSizeChange: () => {},
  onMinDurationChange: () => {},
  onViewModeChange: () => {},
  onSearch: () => {},
  onCancel: () => {},
};

describe('SearchBar', () => {
  test('Search button is disabled when input is empty', () => {
    render(<SearchBar {...baseProps} />);
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled();
  });

  test('clicking Search calls onSearch', () => {
    const onSearch = jest.fn();
    render(<SearchBar {...baseProps} query="minecraft" onSearch={onSearch} />);
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(onSearch).toHaveBeenCalled();
  });

  test('Enter triggers onSearch when not loading', () => {
    const onSearch = jest.fn();
    render(<SearchBar {...baseProps} query="minecraft" onSearch={onSearch} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalled();
  });

  test('whole bar locks during loading; Cancel button visible', () => {
    const onCancel = jest.fn();
    render(<SearchBar {...baseProps} query="minecraft" loading onCancel={onCancel} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('Enter is a no-op while loading', () => {
    const onSearch = jest.fn();
    render(<SearchBar {...baseProps} query="minecraft" loading onSearch={onSearch} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSearch).not.toHaveBeenCalled();
  });

  test('view toggle: current mode is pressed; clicking the other calls onViewModeChange', () => {
    const onViewModeChange = jest.fn();
    render(<SearchBar {...baseProps} viewMode="grid" onViewModeChange={onViewModeChange} />);
    expect(screen.getByRole('button', { name: /grid view/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /table view/i })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /table view/i }));
    expect(onViewModeChange).toHaveBeenCalledWith('table');
  });
});
