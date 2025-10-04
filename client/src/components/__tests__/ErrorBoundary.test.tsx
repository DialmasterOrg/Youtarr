import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ErrorBoundary from '../ErrorBoundary';

const SAFE_CHILD_TEXT = 'Safe child content';
const setNodeEnv = (value?: string) => {
  const env = process.env as Record<string, string | undefined>;

  if (value === undefined) {
    delete env.NODE_ENV;
  } else {
    env.NODE_ENV = value;
  }
};

const ThrowingComponent: React.FC<{ shouldThrow: boolean; message?: string }> = ({
  shouldThrow,
  message = 'Simulated failure'
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }

  return <div>{SAFE_CHILD_TEXT}</div>;
};

describe('ErrorBoundary', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    jest.restoreAllMocks();
    setNodeEnv(originalNodeEnv);
  });

  test('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>{SAFE_CHILD_TEXT}</div>
      </ErrorBoundary>
    );

    expect(screen.getByText(SAFE_CHILD_TEXT)).toBeInTheDocument();
  });

  test('renders fallback with default message when child throws', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow message="Explosive failure" />
      </ErrorBoundary>
    );

    expect(
      screen.getByText(/oops! something went wrong/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Something went wrong. Please try refreshing the page.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Explosive failure/)).not.toBeInTheDocument();

    const boundaryLog = consoleErrorSpy.mock.calls.find(
      (args) => args[0] === 'ErrorBoundary caught an error:'
    );
    expect(boundaryLog).toBeDefined();
    expect(boundaryLog?.[1]).toBeInstanceOf(Error);
  });

  test('uses provided fallback message and reset handler recovers when error clears', async () => {
    const user = userEvent.setup();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = jest.fn();

    const ResetHarness: React.FC = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);

      const handleReset = () => {
        onReset();
        setShouldThrow(false);
      };

      return (
        <ErrorBoundary fallbackMessage="Custom fallback" onReset={handleReset}>
          <ThrowingComponent shouldThrow={shouldThrow} message="Reset required" />
        </ErrorBoundary>
      );
    };

    render(<ResetHarness />);

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(SAFE_CHILD_TEXT)).toBeInTheDocument();
    });
    expect(screen.queryByText('Custom fallback')).not.toBeInTheDocument();
  });

  test('shows error details when running in development mode', () => {
    setNodeEnv('development');
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow message="Detail exposure" />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Detail exposure/)).toBeInTheDocument();
  });
});
