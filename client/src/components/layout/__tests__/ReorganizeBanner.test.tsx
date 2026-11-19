import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReorganizeBanner } from '../ReorganizeBanner';

const mockUseActiveReorganize = jest.fn();
jest.mock('../../shared/Reorganize/hooks/useActiveReorganize', () => ({
  useActiveReorganize: (token: string | null) => mockUseActiveReorganize(token),
}));

describe('ReorganizeBanner', () => {
  test('shows nothing when no reorganize runs', () => {
    mockUseActiveReorganize.mockReturnValue({ operation: null });
    render(<ReorganizeBanner token="token" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Moving downloaded videos/)).not.toBeInTheDocument();
  });

  test('says what is being moved and that downloads wait', () => {
    mockUseActiveReorganize.mockReturnValue({ operation: { id: 3, label: 'Chan', status: 'running', total: 10, done: 3, failed: 1 } });
    render(<ReorganizeBanner token="token" />);

    expect(screen.getByText(/Moving downloaded videos for Chan: 4 of 10\./)).toBeInTheDocument();
    expect(screen.getByText(/Downloads wait in the queue/)).toBeInTheDocument();
  });
});
