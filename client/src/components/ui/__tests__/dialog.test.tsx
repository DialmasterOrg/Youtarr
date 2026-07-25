import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '../dialog';

describe('Dialog', () => {
  describe('maxWidth mapping', () => {
    const renderWithMaxWidth = (maxWidth: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
      render(
        <Dialog open onClose={() => {}} maxWidth={maxWidth} fullWidth>
          <DialogContent>content</DialogContent>
        </Dialog>
      );
      return screen.getByRole('dialog');
    };

    test('sm dialogs are capped at 600px', () => {
      expect(renderWithMaxWidth('sm')).toHaveClass('max-w-[600px]');
    });

    test('xs dialogs are capped at 448px', () => {
      expect(renderWithMaxWidth('xs')).toHaveClass('max-w-md');
    });

    test('md dialogs are capped at 768px', () => {
      expect(renderWithMaxWidth('md')).toHaveClass('max-w-3xl');
    });

    test('lg dialogs are capped at 896px', () => {
      expect(renderWithMaxWidth('lg')).toHaveClass('max-w-4xl');
    });

    test('xl dialogs are capped at 1152px', () => {
      expect(renderWithMaxWidth('xl')).toHaveClass('max-w-6xl');
    });
  });

  describe('DialogTitle', () => {
    test('lays out icon and text on a single centered row', () => {
      render(
        <Dialog open onClose={() => {}}>
          <DialogTitle>
            <svg data-testid="title-icon" />
            Confirm something
          </DialogTitle>
        </Dialog>
      );

      // Tailwind preflight makes svg display:block, so the title span must be
      // a flex row or the icon stacks above the text
      const titleSpan = screen.getByText('Confirm something');
      expect(titleSpan).toHaveClass('flex', 'items-center');
      expect(screen.getByTestId('title-icon')).toBeInTheDocument();
    });
  });

  describe('DialogActions', () => {
    test('separates the buttons from the divider with vertical padding', () => {
      render(
        <Dialog open onClose={() => {}}>
          <DialogActions data-testid="actions">
            <button>Cancel</button>
          </DialogActions>
        </Dialog>
      );

      const actions = screen.getByTestId('actions');
      expect(actions).toHaveClass('py-3', 'border-t');
    });
  });
});
