import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListFilterChips, {
  countActiveFilters,
  hasActiveFilters,
  clearAllFilters,
} from '../VideoListFilterChips';
import { FilterConfig } from '../types';
import { renderWithProviders } from '../../../../test-utils';

describe('VideoListFilterChips', () => {
  test('renders nothing when no filters are active', () => {
    const filters: FilterConfig[] = [
      { id: 'maxRating', value: '', onChange: jest.fn() },
      { id: 'protected', value: false, onChange: jest.fn() },
    ];
    renderWithProviders(<VideoListFilterChips filters={filters} />);
    expect(screen.queryByTestId('video-list-filter-chips')).not.toBeInTheDocument();
  });

  test('renders a chip per active filter', () => {
    const filters: FilterConfig[] = [
      { id: 'maxRating', value: 'TV-14', onChange: jest.fn() },
      { id: 'protected', value: true, onChange: jest.fn() },
      {
        id: 'duration',
        min: 5,
        max: null,
        inputMin: 5,
        inputMax: null,
        onMinChange: jest.fn(),
        onMaxChange: jest.fn(),
      },
    ];
    renderWithProviders(<VideoListFilterChips filters={filters} />);
    expect(screen.getByText(/Rating:/i)).toBeInTheDocument();
    expect(screen.getByText(/Protected only/i)).toBeInTheDocument();
    expect(screen.getByText(/5\+ min/i)).toBeInTheDocument();
  });

  test('clicking a chip delete icon clears that filter', async () => {
    const user = userEvent.setup();
    const onRatingChange = jest.fn();
    const filters: FilterConfig[] = [{ id: 'maxRating', value: 'PG', onChange: onRatingChange }];

    renderWithProviders(<VideoListFilterChips filters={filters} />);
    const deleteIcon = screen.getByTestId('CancelIcon');
    await user.click(deleteIcon);
    expect(onRatingChange).toHaveBeenCalledWith('');
  });

  test('hidden date-range filter does not render a chip', () => {
    const filters: FilterConfig[] = [
      {
        id: 'dateRange',
        dateFrom: new Date(2024, 0, 1),
        dateTo: new Date(2024, 1, 1),
        onFromChange: jest.fn(),
        onToChange: jest.fn(),
        hidden: true,
      },
    ];
    renderWithProviders(<VideoListFilterChips filters={filters} />);
    expect(screen.queryByTestId('video-list-filter-chips')).not.toBeInTheDocument();
  });

  test('countActiveFilters counts duration and date ranges as one', () => {
    const filters: FilterConfig[] = [
      {
        id: 'duration',
        min: 5,
        max: 10,
        inputMin: 5,
        inputMax: 10,
        onMinChange: jest.fn(),
        onMaxChange: jest.fn(),
      },
      {
        id: 'dateRange',
        dateFrom: new Date(2024, 0, 1),
        dateTo: new Date(2024, 1, 1),
        onFromChange: jest.fn(),
        onToChange: jest.fn(),
      },
      { id: 'maxRating', value: 'PG', onChange: jest.fn() },
    ];
    expect(countActiveFilters(filters)).toBe(3);
    expect(hasActiveFilters(filters)).toBe(true);
  });

  test('clearAllFilters calls the right handlers', () => {
    const onMin = jest.fn();
    const onMax = jest.fn();
    const onFromChange = jest.fn();
    const onToChange = jest.fn();
    const onRating = jest.fn();
    const onProtected = jest.fn();

    const filters: FilterConfig[] = [
      {
        id: 'duration',
        min: 5,
        max: 10,
        inputMin: 5,
        inputMax: 10,
        onMinChange: onMin,
        onMaxChange: onMax,
      },
      {
        id: 'dateRange',
        dateFrom: new Date(),
        dateTo: new Date(),
        onFromChange,
        onToChange,
      },
      { id: 'maxRating', value: 'PG', onChange: onRating },
      { id: 'protected', value: true, onChange: onProtected },
    ];

    clearAllFilters(filters);
    expect(onMin).toHaveBeenCalledWith(null);
    expect(onMax).toHaveBeenCalledWith(null);
    expect(onFromChange).toHaveBeenCalledWith(null);
    expect(onToChange).toHaveBeenCalledWith(null);
    expect(onRating).toHaveBeenCalledWith('');
    expect(onProtected).toHaveBeenCalledWith(false);
  });
});
