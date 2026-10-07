import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MaxRatingFilter from '../MaxRatingFilter';

describe('MaxRatingFilter', () => {
  const openMenu = () => fireEvent.mouseDown(screen.getByRole('button', { name: 'No limit' }));

  test('offers rating levels as maximums', async () => {
    render(<MaxRatingFilter value="" onChange={jest.fn()} />);
    openMenu();
    expect(await screen.findByRole('option', { name: 'TV-MA' })).toBeInTheDocument();
  });

  test('does not offer Not Rated as a maximum', async () => {
    render(<MaxRatingFilter value="" onChange={jest.fn()} />);
    openMenu();
    await screen.findByRole('option', { name: 'TV-MA' });
    expect(screen.queryByRole('option', { name: 'NR' })).not.toBeInTheDocument();
  });

  test('calls onChange with the selected rating', async () => {
    const onChange = jest.fn();
    render(<MaxRatingFilter value="" onChange={onChange} />);
    openMenu();
    fireEvent.click(await screen.findByRole('option', { name: 'PG-13' }));
    expect(onChange).toHaveBeenCalledWith('PG-13');
  });
});
