import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from '../SearchBar';

const baseProps = {
  query: '',
  pageSize: 25 as const,
  loading: false,
  onQueryChange: jest.fn(),
  onPageSizeChange: jest.fn(),
  onSearch: jest.fn(),
  onCancel: jest.fn(),
};

describe('FindChannels SearchBar', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('Search is disabled when the query is empty or whitespace', () => {
    const { rerender } = render(<SearchBar {...baseProps} query="" />);
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();

    rerender(<SearchBar {...baseProps} query="   " />);
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  test('clicking Search fires onSearch', () => {
    render(<SearchBar {...baseProps} query="minecraft" />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(baseProps.onSearch).toHaveBeenCalledTimes(1);
  });

  test('Enter in the text field fires onSearch when searchable', () => {
    render(<SearchBar {...baseProps} query="minecraft" />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(baseProps.onSearch).toHaveBeenCalledTimes(1);
  });

  test('while loading, input is disabled and Cancel replaces Search', () => {
    render(<SearchBar {...baseProps} query="minecraft" loading />);

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('typing fires onQueryChange', () => {
    render(<SearchBar {...baseProps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mc' } });
    expect(baseProps.onQueryChange).toHaveBeenCalledWith('mc');
  });
});
