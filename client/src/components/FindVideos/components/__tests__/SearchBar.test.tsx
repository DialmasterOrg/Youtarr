import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  test('Search button is disabled when input is empty', () => {
    render(
      <SearchBar
        query="" pageSize={25} loading={false}
        onQueryChange={() => {}} onPageSizeChange={() => {}}
        onSearch={() => {}} onCancel={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  test('clicking Search calls onSearch', () => {
    const onSearch = jest.fn();
    render(
      <SearchBar
        query="minecraft" pageSize={25} loading={false}
        onQueryChange={() => {}} onPageSizeChange={() => {}}
        onSearch={onSearch} onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalled();
  });

  test('Enter triggers onSearch when not loading', () => {
    const onSearch = jest.fn();
    render(
      <SearchBar
        query="minecraft" pageSize={25} loading={false}
        onQueryChange={() => {}} onPageSizeChange={() => {}}
        onSearch={onSearch} onCancel={() => {}}
      />
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalled();
  });

  test('whole bar locks during loading; Cancel button visible', () => {
    const onCancel = jest.fn();
    render(
      <SearchBar
        query="minecraft" pageSize={25} loading={true}
        onQueryChange={() => {}} onPageSizeChange={() => {}}
        onSearch={() => {}} onCancel={onCancel}
      />
    );
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('Enter is a no-op while loading', () => {
    const onSearch = jest.fn();
    render(
      <SearchBar
        query="minecraft" pageSize={25} loading={true}
        onQueryChange={() => {}} onPageSizeChange={() => {}}
        onSearch={onSearch} onCancel={() => {}}
      />
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSearch).not.toHaveBeenCalled();
  });
});
