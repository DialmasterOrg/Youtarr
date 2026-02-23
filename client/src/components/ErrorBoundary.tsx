import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert } from './ui';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '../lib/icons';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallbackMessage = 'Something went wrong. Please try refreshing the page.' } = this.props;

      return (
        <Paper elevation={3} className="p-8 m-4">
          <Box className="flex flex-col items-center gap-4 text-center">
            <ErrorIcon className="text-destructive" size={48} />

            <Typography variant="h5" component="h2" gutterBottom>
              Oops! Something went wrong
            </Typography>

            <Alert severity="error" className="w-full max-w-[600px]">
              {fallbackMessage}
            </Alert>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box className="mt-4 p-4 bg-muted rounded-[var(--radius-ui)] w-full max-w-[600px] overflow-auto">
                <Typography variant="caption" component="pre" className="text-left">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}

            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon size={16} />}
              onClick={this.handleReset}
              className="mt-4"
            >
              Try Again
            </Button>
          </Box>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;