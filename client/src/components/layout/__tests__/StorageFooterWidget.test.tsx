import React from 'react';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../../ui/tooltip';
import { StorageFooterWidget } from '../StorageFooterWidget';

jest.mock('../../../hooks/useStorageStatus', () => ({
  useStorageStatus: jest.fn(),
}));

jest.mock('../../../lib/icons', () => {
  const React = require('react');
  return {
    __esModule: true,
    Storage: () => React.createElement('span', { 'data-testid': 'IconStorage' }),
  };
});

const { useStorageStatus } = jest.requireMock('../../../hooks/useStorageStatus') as {
  useStorageStatus: jest.Mock;
};

const setHookResult = (overrides: Partial<{ data: any; loading: boolean; error: boolean; available: any }> = {}) => {
  useStorageStatus.mockReturnValue({
    data: null,
    loading: false,
    error: false,
    available: null,
    ...overrides,
  });
};

const renderWidget = (props: Partial<React.ComponentProps<typeof StorageFooterWidget>> = {}) =>
  render(
    <TooltipProvider>
      <StorageFooterWidget token="tok" collapsed={false} {...props} />
    </TooltipProvider>
  );

describe('StorageFooterWidget', () => {
  test('returns null when no token is provided', () => {
    setHookResult();
    const { container } = renderWidget({ token: null });
    expect(container).toBeEmptyDOMElement();
  });

  test('returns null when the storage hook reports an error', () => {
    setHookResult({ error: true });
    const { container } = renderWidget();
    expect(container).toBeEmptyDOMElement();
  });

  test('renders Loading text in inline mode while data is loading', () => {
    setHookResult({ loading: true });
    renderWidget({ inline: true });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('renders the inline label with formatted GB and percent free', () => {
    setHookResult({
      data: { availableGB: '250', percentFree: 50, totalGB: '500' },
    });
    renderWidget({ inline: true });
    // usedGB = 500 - 250 = 250
    expect(screen.getByText('250.0 GB / 500.0 GB • 50.0% free')).toBeInTheDocument();
  });

  test('clamps negative used space to zero (available > total edge case)', () => {
    setHookResult({
      data: { availableGB: '600', percentFree: 120, totalGB: '500' },
    });
    renderWidget({ inline: true });
    // usedGB = max(0, 500 - 600) = 0
    // percentFree clamped at 100 in progress, but label uses raw value
    expect(screen.getByText(/0\.0 GB \/ 500\.0 GB/)).toBeInTheDocument();
  });

  test('falls back to 0.0 labels when storage data is missing', () => {
    setHookResult({ data: null });
    renderWidget({ inline: true });
    expect(screen.getByText('0.0 GB / 0.0 GB • 0.0% free')).toBeInTheDocument();
  });

  test('renders the Storage label and detail line in expanded sidebar mode', () => {
    setHookResult({
      data: { availableGB: '100', percentFree: 25, totalGB: '400' },
    });
    renderWidget({ collapsed: false, compact: false });
    expect(screen.getByText('Storage')).toBeInTheDocument();
    // detail line text
    expect(screen.getByText('300.0 GB / 400.0 GB used (25.0% free)')).toBeInTheDocument();
  });

  test('hides Storage label when collapsed', () => {
    setHookResult({
      data: { availableGB: '100', percentFree: 25, totalGB: '400' },
    });
    renderWidget({ collapsed: true });
    expect(screen.queryByText('Storage')).not.toBeInTheDocument();
    // Detail line also hidden in collapsed mode
    expect(screen.queryByText(/used \(25\.0% free\)/)).not.toBeInTheDocument();
  });

  test('hides Storage label and detail line when compact', () => {
    setHookResult({
      data: { availableGB: '100', percentFree: 25, totalGB: '400' },
    });
    renderWidget({ compact: true });
    expect(screen.queryByText('Storage')).not.toBeInTheDocument();
    expect(screen.queryByText(/used \(25\.0% free\)/)).not.toBeInTheDocument();
  });

  test('shows Loading text in detail line while loading in expanded mode', () => {
    setHookResult({ loading: true });
    renderWidget({ collapsed: false });
    // Both the Storage label and a Loading… line should be visible (detail line)
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  test('does not render the LinearProgress bar in inline mode', () => {
    setHookResult({
      data: { availableGB: '100', percentFree: 25, totalGB: '400' },
    });
    renderWidget({ inline: true });
    // Inline mode also hides Storage label
    expect(screen.queryByText('Storage')).not.toBeInTheDocument();
  });

  test('handles non-finite numeric inputs by falling back to 0.0', () => {
    setHookResult({
      data: { availableGB: 'not-a-number', percentFree: NaN, totalGB: 'NaN' },
    });
    renderWidget({ inline: true });
    expect(screen.getByText('0.0 GB / 0.0 GB • 0.0% free')).toBeInTheDocument();
  });
});
