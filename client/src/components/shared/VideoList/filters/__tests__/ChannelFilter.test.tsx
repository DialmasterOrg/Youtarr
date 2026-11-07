import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChannelFilter from '../ChannelFilter';

describe('ChannelFilter', () => {
  test('button keeps foreground text on hover', () => {
    render(<ChannelFilter value="" options={['Channel A']} onChange={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Filter by Channel' });
    expect(button).toHaveClass('hover:text-foreground');
    expect(button).not.toHaveClass('hover:text-primary-foreground');
  });
});
