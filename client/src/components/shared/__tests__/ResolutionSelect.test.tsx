import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResolutionSelect } from '../ResolutionSelect';

describe('ResolutionSelect', () => {
  test('renders with default label and the selected value', () => {
    render(<ResolutionSelect value="1080" onChange={jest.fn()} />);
    const select = screen.getByLabelText('Maximum Resolution');
    expect(select).toHaveTextContent('1080p (Full HD)');
  });

  test('uses a custom label', () => {
    render(<ResolutionSelect value="720" onChange={jest.fn()} label="Channel Video Quality Override" />);
    expect(screen.getByLabelText('Channel Video Quality Override')).toBeInTheDocument();
  });

  test('renders the empty option when emptyLabel is provided', async () => {
    render(<ResolutionSelect value={null} onChange={jest.fn()} emptyLabel="Using Global Setting" />);
    fireEvent.mouseDown(screen.getByLabelText('Maximum Resolution'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Using Global Setting' })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: '2160p (4K)' })).toBeInTheDocument();
  });

  test('does not render an empty option when emptyLabel is omitted', async () => {
    render(<ResolutionSelect value="1080" onChange={jest.fn()} />);
    fireEvent.mouseDown(screen.getByLabelText('Maximum Resolution'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '720p (HD)' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: /Global/ })).not.toBeInTheDocument();
  });

  test('calls onChange with the selected resolution', async () => {
    const onChange = jest.fn();
    render(<ResolutionSelect value="1080" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByLabelText('Maximum Resolution'));
    fireEvent.click(await screen.findByRole('option', { name: '720p (HD)' }));
    expect(onChange).toHaveBeenCalledWith('720');
  });

  test('calls onChange with null when the empty option is selected', async () => {
    const onChange = jest.fn();
    render(<ResolutionSelect value="720" onChange={onChange} emptyLabel="Using Global Setting" />);
    fireEvent.mouseDown(screen.getByLabelText('Maximum Resolution'));
    fireEvent.click(await screen.findByRole('option', { name: 'Using Global Setting' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
