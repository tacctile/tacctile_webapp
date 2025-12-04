/**
 * ErrorBoundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';

const ErrorContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 200,
  padding: 32,
  backgroundColor: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #cf6679',
});

const ErrorIcon = styled(Box)({
  width: 64,
  height: 64,
  borderRadius: '50%',
  backgroundColor: 'rgba(207, 102, 121, 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 16,
  color: '#cf6679',
  fontSize: 32,
});

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  toolName?: string;
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
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log to console in development
    console.error('ErrorBoundary caught error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Report to Sentry in production
    if (import.meta.env.PROD) {
      import('@sentry/react').then(Sentry => {
        Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
      });
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorContainer>
          <ErrorIcon>
            <span className="material-symbols-outlined">error</span>
          </ErrorIcon>
          <Typography variant="h6" sx={{ color: '#e1e1e1', mb: 1 }}>
            {this.props.toolName ? `${this.props.toolName} Error` : 'Something went wrong'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#888', mb: 3, textAlign: 'center', maxWidth: 400 }}>
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={this.handleRetry}
              sx={{
                color: '#19abb5',
                borderColor: '#19abb5',
                '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
              }}
            >
              Try Again
            </Button>
            <Button
              variant="text"
              onClick={() => window.location.reload()}
              sx={{ color: '#888' }}
            >
              Reload Page
            </Button>
          </Box>
          {import.meta.env.DEV && this.state.errorInfo && (
            <Box
              sx={{
                mt: 3,
                p: 2,
                backgroundColor: '#121212',
                borderRadius: 4,
                maxWidth: '100%',
                overflow: 'auto',
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#888',
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </Box>
          )}
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
