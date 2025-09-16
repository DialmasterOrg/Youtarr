import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UrlInput from '../UrlInput';

const mockReadText = jest.fn();

describe('UrlInput', () => {
  const mockOnValidate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadText.mockClear();
    // Suppress MUI Tooltip warnings about disabled buttons
    jest.spyOn(console, 'error').mockImplementation((msg) => {
      if (typeof msg === 'string' && msg.includes('MUI: You are providing a disabled')) {
        return;
      }
      console.warn(msg);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  test('renders with initial state', () => {
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(input).not.toBeDisabled();

    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i });
    expect(pasteButton).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const addButton = buttons[buttons.length - 1];
    expect(addButton).toBeDisabled();
  });

  test('updates input value when user types', async () => {
    const user = userEvent.setup({ delay: null });
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, 'https://youtube.com/watch?v=test123');

    expect(input).toHaveValue('https://youtube.com/watch?v=test123');
  });

  test('enables add button when input has value', async () => {
    const user = userEvent.setup({ delay: null });
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');

    let buttons = screen.getAllByRole('button');
    let addButton = buttons[buttons.length - 1];
    expect(addButton).toBeDisabled();

    await user.type(input, 'https://youtube.com/watch?v=test');

    buttons = screen.getAllByRole('button');
    addButton = buttons[buttons.length - 1];
    expect(addButton).not.toBeDisabled();
  });

  test('shows clear button when input has value', async () => {
    const user = userEvent.setup({ delay: null });
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');

    let buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    await user.type(input, 'https://youtube.com/watch?v=test');

    buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    const clearButton = buttons[1];
    expect(clearButton).not.toBeDisabled();
  });

  test('clears input when clear button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, 'https://youtube.com/watch?v=test');

    const buttons = screen.getAllByRole('button');
    const clearButton = buttons[1];
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });

  test('calls onValidate when add button is clicked', async () => {
    mockOnValidate.mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, 'https://youtube.com/watch?v=test123');

    const buttons = screen.getAllByRole('button');
    const addButton = buttons[buttons.length - 1];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalledWith('https://youtube.com/watch?v=test123');
    });
  });

  test('clears input after successful validation', async () => {
    mockOnValidate.mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, 'https://youtube.com/watch?v=test123');

    const buttons = screen.getAllByRole('button');
    const addButton = buttons[buttons.length - 1];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  test('keeps input value after failed validation', async () => {
    mockOnValidate.mockResolvedValue(false);
    const user = userEvent.setup({ delay: null });

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    const testUrl = 'https://youtube.com/watch?v=test123';
    await user.type(input, testUrl);

    const buttons = screen.getAllByRole('button');
    const addButton = buttons[buttons.length - 1];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalled();
    });

    expect(input).toHaveValue(testUrl);
  });

  test('handles Enter key press to submit', async () => {
    mockOnValidate.mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, 'https://youtube.com/watch?v=test123');

    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalledWith('https://youtube.com/watch?v=test123');
    });
  });

  test('ignores Enter key when input is empty', () => {
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(mockOnValidate).not.toHaveBeenCalled();
  });

  test('ignores Enter key when validating', async () => {
    const user = userEvent.setup({ delay: null });
    render(<UrlInput onValidate={mockOnValidate} isValidating={true} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, 'https://youtube.com/watch?v=test123');

    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(mockOnValidate).not.toHaveBeenCalled();
  });

  test('shows loading spinner when validating', () => {
    render(<UrlInput onValidate={mockOnValidate} isValidating={true} />);

    // Now we have both LinearProgress and CircularProgress, so we expect 2 progress indicators
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
  });

  test('disables input when validating', () => {
    render(<UrlInput onValidate={mockOnValidate} isValidating={true} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    expect(input).toBeDisabled();
  });

  test('disables all buttons when validating', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, 'https://youtube.com/watch?v=test');

    rerender(<UrlInput onValidate={mockOnValidate} isValidating={true} />);

    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i });
    expect(pasteButton).toBeDisabled();
  });

  test('handles disabled prop', () => {
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} disabled={true} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    expect(input).toBeDisabled();

    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i });
    expect(pasteButton).toBeDisabled();
  });

  test('handles paste event with YouTube URL', async () => {
    jest.useFakeTimers();
    mockOnValidate.mockResolvedValue(true);
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    const pasteData = 'https://youtube.com/watch?v=abc123';

    const pasteEvent = {
      clipboardData: {
        getData: jest.fn().mockReturnValue(pasteData)
      },
      preventDefault: jest.fn()
    };

    fireEvent.paste(input, pasteEvent);

    expect(input).toHaveValue(pasteData);

    await waitFor(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalledWith(pasteData);
    });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });

    jest.useRealTimers();
  });

  test('handles paste event with youtu.be URL', async () => {
    jest.useFakeTimers();
    mockOnValidate.mockResolvedValue(true);
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    const pasteData = 'https://youtu.be/abc123';

    const pasteEvent = {
      clipboardData: {
        getData: jest.fn().mockReturnValue(pasteData)
      },
      preventDefault: jest.fn()
    };

    fireEvent.paste(input, pasteEvent);

    expect(input).toHaveValue(pasteData);

    await waitFor(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalledWith(pasteData);
    });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });

    jest.useRealTimers();
  });

  test('ignores paste event with non-YouTube URL', () => {
    jest.useFakeTimers();
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    const pasteData = 'https://example.com/video';

    const pasteEvent = {
      clipboardData: {
        getData: jest.fn().mockReturnValue(pasteData)
      },
      preventDefault: jest.fn()
    };

    fireEvent.paste(input, pasteEvent);

    expect(input).toHaveValue('');

    jest.advanceTimersByTime(500);

    expect(mockOnValidate).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('clears input after successful paste validation', async () => {
    jest.useFakeTimers();
    mockOnValidate.mockResolvedValue(true);
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    const pasteData = 'https://youtube.com/watch?v=test';

    const pasteEvent = {
      clipboardData: {
        getData: jest.fn().mockReturnValue(pasteData)
      },
      preventDefault: jest.fn()
    };

    fireEvent.paste(input, pasteEvent);

    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(input).toHaveValue('');
    });

    jest.useRealTimers();
  });

  test('keeps input after failed paste validation', async () => {
    jest.useFakeTimers();
    mockOnValidate.mockResolvedValue(false);
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    const pasteData = 'https://youtube.com/watch?v=test';

    const pasteEvent = {
      clipboardData: {
        getData: jest.fn().mockReturnValue(pasteData)
      },
      preventDefault: jest.fn()
    };

    fireEvent.paste(input, pasteEvent);

    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalled();
    });

    expect(input).toHaveValue(pasteData);
    jest.useRealTimers();
  });

  test('handles paste button click', async () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: mockReadText,
      },
      writable: true,
    });

    mockOnValidate.mockResolvedValue(true);
    const clipboardText = 'https://youtube.com/watch?v=paste123';
    mockReadText.mockResolvedValue(clipboardText);

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i });

    fireEvent.click(pasteButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste YouTube video URL here...')).toHaveValue(clipboardText);
    });

    await waitFor(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalledWith(clipboardText);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste YouTube video URL here...')).toHaveValue('');
    });

    jest.useRealTimers();
  });

  test('handles paste button click with empty clipboard', async () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: mockReadText,
      },
      writable: true,
    });

    mockReadText.mockResolvedValue('');

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i });

    fireEvent.click(pasteButton);

    await waitFor(() => {
      expect(mockReadText).toHaveBeenCalled();
    });

    jest.advanceTimersByTime(500);

    expect(mockOnValidate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Paste YouTube video URL here...')).toHaveValue('');

    jest.useRealTimers();
  });

  test('handles clipboard read error', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: mockReadText,
      },
      writable: true,
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockReadText.mockRejectedValue(new Error('Clipboard access denied'));

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i });

    fireEvent.click(pasteButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to read clipboard:', expect.any(Error));
    });

    expect(mockOnValidate).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('clears debounce timer when clearing input', async () => {
    jest.useFakeTimers();
    mockOnValidate.mockResolvedValue(true);

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');

    const pasteEvent = {
      clipboardData: {
        getData: jest.fn().mockReturnValue('https://youtube.com/watch?v=test')
      },
      preventDefault: jest.fn()
    };

    fireEvent.paste(input, pasteEvent);

    const buttons = screen.getAllByRole('button');
    const clearButton = buttons[1];
    fireEvent.click(clearButton);

    jest.advanceTimersByTime(500);

    expect(mockOnValidate).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('cleans up debounce timer on unmount', () => {
    jest.useFakeTimers();
    const { unmount } = render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');

    const pasteEvent = {
      clipboardData: {
        getData: jest.fn().mockReturnValue('https://youtube.com/watch?v=test')
      },
      preventDefault: jest.fn()
    };

    fireEvent.paste(input, pasteEvent);

    unmount();

    jest.advanceTimersByTime(500);

    expect(mockOnValidate).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('trims whitespace when validating', async () => {
    mockOnValidate.mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });

    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, '  https://youtube.com/watch?v=test123  ');

    const buttons = screen.getAllByRole('button');
    const addButton = buttons[buttons.length - 1];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalledWith('https://youtube.com/watch?v=test123');
    });
  });

  test('does not call onValidate with only whitespace', async () => {
    const user = userEvent.setup({ delay: null });
    render(<UrlInput onValidate={mockOnValidate} isValidating={false} />);

    const input = screen.getByPlaceholderText('Paste YouTube video URL here...');
    await user.type(input, '   ');

    const buttons = screen.getAllByRole('button');
    const addButton = buttons[buttons.length - 1];

    expect(addButton).toBeDisabled();

    fireEvent.click(addButton);

    expect(mockOnValidate).not.toHaveBeenCalled();
  });
});