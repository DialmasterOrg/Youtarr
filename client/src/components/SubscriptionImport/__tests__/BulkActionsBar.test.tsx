import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkActionsBar from '../components/BulkActionsBar';
import { ReviewChannel, RowState, DEFAULT_ROW_SETTINGS } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';

function makeChannel(overrides: Partial<ReviewChannel> = {}): ReviewChannel {
  return {
    channelId: 'ch1',
    title: 'Channel One',
    url: 'https://youtube.com/channel/ch1',
    thumbnailUrl: null,
    alreadySubscribed: false,
    ...overrides,
  };
}

function makeRowState(overrides: Partial<RowState> = {}): RowState {
  return {
    selected: true,
    settings: { ...DEFAULT_ROW_SETTINGS },
    ...overrides,
  };
}

describe('BulkActionsBar', () => {
  const mockDispatch = jest.fn() as jest.Mock<void, [ImportFlowAction]>;
  const mockOnStartImport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows correct selection count', () => {
    const channels = [
      makeChannel({ channelId: 'ch1' }),
      makeChannel({ channelId: 'ch2' }),
      makeChannel({ channelId: 'ch3', alreadySubscribed: true }),
    ];
    const rowStates: Record<string, RowState> = {
      ch1: makeRowState({ selected: true }),
      ch2: makeRowState({ selected: false }),
      ch3: makeRowState({ selected: false }),
    };

    render(
      <BulkActionsBar
        channels={channels}
        rowStates={rowStates}
        dispatch={mockDispatch}
        onStartImport={mockOnStartImport}
        importDisabled={false}
      />
    );

    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
  });

  test('"Select all" dispatches SELECT_ALL', () => {
    const channels = [makeChannel()];
    const rowStates: Record<string, RowState> = {
      ch1: makeRowState({ selected: false }),
    };

    render(
      <BulkActionsBar
        channels={channels}
        rowStates={rowStates}
        dispatch={mockDispatch}
        onStartImport={mockOnStartImport}
        importDisabled={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^select all$/i }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SELECT_ALL' });
  });

  test('"Deselect all" dispatches DESELECT_ALL', () => {
    const channels = [makeChannel()];
    const rowStates: Record<string, RowState> = {
      ch1: makeRowState({ selected: true }),
    };

    render(
      <BulkActionsBar
        channels={channels}
        rowStates={rowStates}
        dispatch={mockDispatch}
        onStartImport={mockOnStartImport}
        importDisabled={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'DESELECT_ALL' });
  });

  test('import button shows count and is disabled when no selection', () => {
    const channels = [makeChannel()];
    const rowStates: Record<string, RowState> = {
      ch1: makeRowState({ selected: false }),
    };

    render(
      <BulkActionsBar
        channels={channels}
        rowStates={rowStates}
        dispatch={mockDispatch}
        onStartImport={mockOnStartImport}
        importDisabled={false}
      />
    );

    const importButton = screen.getByRole('button', { name: /import selected \(0\)/i });
    expect(importButton).toBeDisabled();
  });

  test('import button calls onStartImport when clicked', () => {
    const channels = [makeChannel()];
    const rowStates: Record<string, RowState> = {
      ch1: makeRowState({ selected: true }),
    };

    render(
      <BulkActionsBar
        channels={channels}
        rowStates={rowStates}
        dispatch={mockDispatch}
        onStartImport={mockOnStartImport}
        importDisabled={false}
      />
    );

    const importButton = screen.getByRole('button', { name: /import selected \(1\)/i });
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);
    expect(mockOnStartImport).toHaveBeenCalledTimes(1);
  });

  test('import button is disabled when importDisabled is true even with selections', () => {
    const channels = [makeChannel()];
    const rowStates: Record<string, RowState> = {
      ch1: makeRowState({ selected: true }),
    };

    render(
      <BulkActionsBar
        channels={channels}
        rowStates={rowStates}
        dispatch={mockDispatch}
        onStartImport={mockOnStartImport}
        importDisabled={true}
      />
    );

    const importButton = screen.getByRole('button', { name: /import selected \(1\)/i });
    expect(importButton).toBeDisabled();
  });
});
