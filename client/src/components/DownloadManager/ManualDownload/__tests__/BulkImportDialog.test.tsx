import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BulkImportDialog from '../BulkImportDialog';

describe('BulkImportDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnImport = jest.fn();
  const emptySet = new Set<string>();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onImport: mockOnImport,
    existingVideoIds: emptySet,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    test('renders dialog when open', () => {
      render(<BulkImportDialog {...defaultProps} />);

      expect(screen.getByText('Bulk Import URLs')).toBeInTheDocument();
      expect(
        screen.getByText('Paste YouTube video URLs, one per line:')
      ).toBeInTheDocument();
      expect(screen.getByTestId('bulk-import-textarea')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /upload .txt file/i })
      ).toBeInTheDocument();
    });

    test('does not render dialog when closed', () => {
      render(<BulkImportDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Bulk Import URLs')).not.toBeInTheDocument();
    });

    test('shows re-download guidance text', () => {
      render(<BulkImportDialog {...defaultProps} />);

      expect(
        screen.getByText(/previously downloaded videos will be skipped/i)
      ).toBeInTheDocument();
    });

    test('Add to Queue button is disabled when no valid URLs', () => {
      render(<BulkImportDialog {...defaultProps} />);

      const addButton = screen.getByTestId('bulk-import-confirm');
      expect(addButton).toBeDisabled();
    });
  });

  describe('URL Parsing', () => {
    test('shows valid URL count after typing', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: {
          value:
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/jNQXAC9IVRw',
        },
      });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText(/2 valid URLs found/i)).toBeInTheDocument();
      });
    });

    test('shows duplicate count', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: {
          value:
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/dQw4w9WgXcQ',
        },
      });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText(/1 valid URL found/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/1 duplicate skipped/i)).toBeInTheDocument();
    });

    test('shows invalid line count', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: {
          value:
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nnot a url\nalso invalid',
        },
      });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText(/1 valid URL found/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/2 invalid lines skipped/i)).toBeInTheDocument();
    });

    test('shows playlist URL message', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: {
          value:
            'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        },
      });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(
          screen.getByText(/playlist URL.*skipped/i)
        ).toBeInTheDocument();
      });
    });

    test('detects duplicates against existing queue', async () => {
      const existingIds = new Set(['dQw4w9WgXcQ']);

      render(
        <BulkImportDialog {...defaultProps} existingVideoIds={existingIds} />
      );

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: {
          value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText(/1 duplicate skipped/i)).toBeInTheDocument();
      });

      expect(screen.getByTestId('bulk-import-confirm')).toBeDisabled();
    });

    test('clears results when textarea is emptied', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');

      fireEvent.change(textarea, {
        target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      });
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText(/1 valid URL found/i)).toBeInTheDocument();
      });

      fireEvent.change(textarea, { target: { value: '' } });
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText(/valid URL/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Import action', () => {
    test('calls onImport with valid videos', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: {
          value:
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/jNQXAC9IVRw',
        },
      });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-confirm')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('bulk-import-confirm'));

      expect(mockOnImport).toHaveBeenCalledTimes(1);
      const importedVideos = mockOnImport.mock.calls[0][0];
      expect(importedVideos).toHaveLength(2);
      expect(importedVideos[0]).toMatchObject({
        youtubeId: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isBulkImport: true,
        channelName: '',
        videoTitle: '',
        duration: 0,
      });
      expect(importedVideos[1]).toMatchObject({
        youtubeId: 'jNQXAC9IVRw',
        isBulkImport: true,
      });
    });

    test('shows correct count in button text', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: {
          value:
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/jNQXAC9IVRw\nhttps://www.youtube.com/watch?v=9bZkp7q19f0',
        },
      });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-confirm')).toHaveTextContent(
          'Add 3 to Queue'
        );
      });
    });
  });

  describe('Close and reset', () => {
    test('calls onClose when Cancel is clicked', () => {
      render(<BulkImportDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when X button is clicked', () => {
      render(<BulkImportDialog {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('resets state when dialog is reopened', async () => {
      const { rerender } = render(<BulkImportDialog {...defaultProps} />);

      const textarea = screen.getByTestId('bulk-import-textarea');
      fireEvent.change(textarea, {
        target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      });
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText(/1 valid URL found/i)).toBeInTheDocument();
      });

      // Close dialog
      rerender(<BulkImportDialog {...defaultProps} open={false} />);

      // Reopen dialog
      rerender(<BulkImportDialog {...defaultProps} open={true} />);

      expect(screen.getByTestId('bulk-import-textarea')).toHaveValue('');
      expect(screen.queryByText(/valid URL/i)).not.toBeInTheDocument();
    });
  });

  describe('File upload', () => {
    test('renders file upload button', () => {
      render(<BulkImportDialog {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /upload .txt file/i })
      ).toBeInTheDocument();
    });

    test('shows error for non-.txt files', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const fileInput = screen.getByTestId('bulk-import-file-input');
      const file = new File(['content'], 'test.csv', { type: 'text/csv' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/please select a .txt file/i)).toBeInTheDocument();
      });
    });

    test('populates textarea with .txt file content', async () => {
      render(<BulkImportDialog {...defaultProps} />);

      const fileContent =
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtu.be/jNQXAC9IVRw';
      const file = new File([fileContent], 'urls.txt', {
        type: 'text/plain',
      });

      const fileInput = screen.getByTestId('bulk-import-file-input');

      // Mock FileReader
      const originalFileReader = global.FileReader;
      const mockFileReader = {
        readAsText: jest.fn(),
        onload: null as any,
        onerror: null as any,
        result: fileContent,
      };
      (global as any).FileReader = jest.fn(() => mockFileReader);

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Trigger the onload callback
      mockFileReader.onload({ target: { result: fileContent } });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-textarea')).toHaveValue(
          fileContent
        );
      });

      // Restore original FileReader
      global.FileReader = originalFileReader;
    });
  });
});
