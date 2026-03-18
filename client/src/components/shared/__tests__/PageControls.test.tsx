import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PageControls from '../PageControls';

describe('PageControls', () => {
  test('renders a condensed pagination model with ellipses for many pages', () => {
    render(<PageControls page={10} totalPages={24} onPageChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go to page 9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go to page 10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go to page 11' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go to page 24' })).toBeInTheDocument();
    expect(screen.getAllByText('...').length).toBe(2);
    expect(screen.queryByRole('button', { name: 'go to page 7' })).not.toBeInTheDocument();
  });

  test('uses a tighter compact mode window', () => {
    render(<PageControls page={10} totalPages={24} onPageChange={jest.fn()} compact />);

    expect(screen.getByRole('button', { name: 'go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go to page 10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go to page 24' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'go to page 9' })).not.toBeInTheDocument();
    expect(screen.getAllByText('...').length).toBe(2);
  });

  test('navigates with previous and next buttons', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();

    render(<PageControls page={5} totalPages={12} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'go to previous page' }));
    await user.click(screen.getByRole('button', { name: 'go to next page' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 4);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 6);
  });
});