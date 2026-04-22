import React, { useEffect } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListSelectionPill from '../VideoListSelectionPill';
import { useVideoSelection, VideoSelectionState } from '../hooks/useVideoSelection';
import { SelectionAction } from '../types';
import { renderWithProviders } from '../../../../test-utils';

interface HarnessProps {
  initialIds?: number[];
  actions?: SelectionAction<number>[];
  isMobile: boolean;
  onSelection?: (selection: VideoSelectionState<number>) => void;
}

function Harness({ initialIds, actions = [], isMobile, onSelection }: HarnessProps) {
  const selection = useVideoSelection<number>({ actions });
  const seededRef = React.useRef(false);
  useEffect(() => {
    if (!seededRef.current && initialIds && initialIds.length > 0) {
      selection.set(initialIds);
      seededRef.current = true;
    }
  }, [initialIds, selection]);
  useEffect(() => {
    onSelection?.(selection);
  }, [selection, onSelection]);
  return <VideoListSelectionPill selection={selection} isMobile={isMobile} />;
}

describe('VideoListSelectionPill', () => {
  test('renders nothing when there is no selection', () => {
    renderWithProviders(<Harness isMobile={false} />);
    expect(screen.queryByTestId('video-list-selection-pill')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-list-selection-count')).not.toBeInTheDocument();
  });

  describe('mobile layout', () => {
    test('shows the selection count and renders one button per action', () => {
      renderWithProviders(
        <Harness
          initialIds={[1, 2, 3]}
          isMobile
          actions={[
            { id: 'delete', label: 'Delete', onClick: jest.fn(), intent: 'danger' },
            { id: 'download', label: 'Download', onClick: jest.fn(), intent: 'success' },
          ]}
        />
      );
      expect(screen.getByText('3 selected')).toBeInTheDocument();
      expect(screen.getByTestId('selection-action-delete')).toBeInTheDocument();
      expect(screen.getByTestId('selection-action-download')).toBeInTheDocument();
    });

    test('clicking an action invokes its onClick with the selected ids', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();
      renderWithProviders(
        <Harness
          initialIds={[10, 20]}
          isMobile
          actions={[{ id: 'delete', label: 'Delete', onClick: onDelete, intent: 'danger' }]}
        />
      );
      await user.click(screen.getByTestId('selection-action-delete'));
      expect(onDelete).toHaveBeenCalledWith([10, 20]);
    });

    test('respects per-action disabled predicate', () => {
      renderWithProviders(
        <Harness
          initialIds={[1]}
          isMobile
          actions={[
            { id: 'delete', label: 'Delete', onClick: jest.fn(), disabled: () => true },
          ]}
        />
      );
      expect(screen.getByTestId('selection-action-delete')).toBeDisabled();
    });

    test('Clear button clears the selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Harness initialIds={[1, 2]} isMobile />);
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /^clear$/i }));
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });
  });

  describe('desktop layout', () => {
    test('renders the pill with selection count and a pluralized aria label', () => {
      renderWithProviders(<Harness initialIds={[1, 2, 3]} isMobile={false} />);
      expect(screen.getByTestId('video-list-selection-count')).toHaveTextContent('3');
      expect(screen.getByLabelText('Actions for 3 selected videos')).toBeInTheDocument();
    });

    test('singular aria label when exactly one item is selected', () => {
      renderWithProviders(<Harness initialIds={[42]} isMobile={false} />);
      expect(screen.getByLabelText('Actions for 1 selected video')).toBeInTheDocument();
    });

    test('caps the visible badge at 99+', () => {
      const ids = Array.from({ length: 120 }, (_, i) => i + 1);
      renderWithProviders(<Harness initialIds={ids} isMobile={false} />);
      expect(screen.getByTestId('video-list-selection-count')).toHaveTextContent('99+');
    });

    test('clicking the pill opens the menu and exposes each action plus Clear Selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <Harness
          initialIds={[1]}
          isMobile={false}
          actions={[
            { id: 'delete', label: 'Delete', onClick: jest.fn(), intent: 'danger' },
            { id: 'download', label: 'Download', onClick: jest.fn() },
          ]}
        />
      );
      await user.click(screen.getByTestId('video-list-selection-pill'));
      expect(await screen.findByTestId('selection-menu-delete')).toBeInTheDocument();
      expect(screen.getByTestId('selection-menu-download')).toBeInTheDocument();
      expect(screen.getByTestId('selection-menu-clear')).toBeInTheDocument();
    });

    test('clicking a menu action invokes its onClick and closes the menu', async () => {
      const user = userEvent.setup();
      const onDelete = jest.fn();
      renderWithProviders(
        <Harness
          initialIds={[5, 6]}
          isMobile={false}
          actions={[{ id: 'delete', label: 'Delete', onClick: onDelete, intent: 'danger' }]}
        />
      );
      await user.click(screen.getByTestId('video-list-selection-pill'));
      const item = await screen.findByTestId('selection-menu-delete');
      await user.click(item);
      expect(onDelete).toHaveBeenCalledWith([5, 6]);
      expect(screen.queryByTestId('selection-menu-delete')).not.toBeInTheDocument();
    });

    test('Clear Selection menu item clears the selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Harness initialIds={[1, 2]} isMobile={false} />);
      await user.click(screen.getByTestId('video-list-selection-pill'));
      await user.click(await screen.findByTestId('selection-menu-clear'));
      expect(screen.queryByTestId('video-list-selection-pill')).not.toBeInTheDocument();
    });

    test('disables a menu item when its disabled predicate returns true', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <Harness
          initialIds={[1]}
          isMobile={false}
          actions={[
            {
              id: 'delete',
              label: 'Delete',
              onClick: jest.fn(),
              disabled: (ids) => ids.length > 0,
            },
          ]}
        />
      );
      await user.click(screen.getByTestId('video-list-selection-pill'));
      const item = await screen.findByTestId('selection-menu-delete');
      expect(item).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
