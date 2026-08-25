import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI; receives reset callback */
  fallback?: (props: { error: Error; reset: () => void; isChunkError: boolean }) => ReactNode;
}

/**
 * Detects dynamic-import / chunk-load failures so we can offer an auto-reload.
 */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('Importing a module script failed') ||
    error.name === 'ChunkLoadError'
  );
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, isChunkError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Auto-reload once on chunk load failures (deploy invalidated old chunks)
    if (isChunkLoadError(error) && !sessionStorage.getItem('chunk-reload')) {
      sessionStorage.setItem('chunk-reload', '1');
      window.location.reload();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      // Allow custom fallback
      if (this.props.fallback && this.state.error) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
          isChunkError: this.state.isChunkError,
        });
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">
            {this.state.isChunkError ? 'Update Available' : 'Something went wrong'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
            {this.state.isChunkError
              ? 'A new version has been deployed. Please reload to get the latest update.'
              : 'An unexpected error occurred. You can try again or refresh the page.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;