import React from 'react';
import { render, screen } from '@testing-library/react';
import { useBreakpoint } from '../useBreakpoint';

const BreakpointProbe = () => {
  const isMobile = useBreakpoint(768);
  return <div data-testid="breakpoint-value">{isMobile ? 'mobile' : 'desktop'}</div>;
};

describe('useBreakpoint', () => {
  it('detects the 768px threshold', () => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width:768px'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<BreakpointProbe />);
    expect(screen.getByTestId('breakpoint-value')).toHaveTextContent('mobile');
  });
});
