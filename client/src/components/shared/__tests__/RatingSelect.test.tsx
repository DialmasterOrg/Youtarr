import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RatingSelect } from '../RatingSelect';

describe('RatingSelect', () => {
  test('renders the default label and empty override option', () => {
    render(<RatingSelect value={null} onChange={jest.fn()} />);
    const select = screen.getByLabelText('Content Rating');
    expect(select).toHaveTextContent('No Override');
  });

  test('lists rating options using full descriptions by default', async () => {
    render(<RatingSelect value={null} onChange={jest.fn()} />);
    fireEvent.mouseDown(screen.getByLabelText('Content Rating'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /General Audiences/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: /Restricted/ })).toBeInTheDocument();
  });

  test('renders badges with short codes when showBadge is set', async () => {
    render(<RatingSelect value={null} onChange={jest.fn()} showBadge emptyLabel="No Rating" />);
    fireEvent.mouseDown(screen.getByLabelText('Content Rating'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /PG-13/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: /TV-MA/ })).toBeInTheDocument();
  });

  test('calls onChange with the selected rating', async () => {
    const onChange = jest.fn();
    render(<RatingSelect value={null} onChange={onChange} />);
    fireEvent.mouseDown(screen.getByLabelText('Content Rating'));
    fireEvent.click(await screen.findByRole('option', { name: /General Audiences/ }));
    expect(onChange).toHaveBeenCalledWith('G');
  });

  test('calls onChange with null when the empty option is selected', async () => {
    const onChange = jest.fn();
    render(<RatingSelect value="G" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByLabelText('Content Rating'));
    fireEvent.click(await screen.findByRole('option', { name: 'No Override' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
