import React from 'react';
import type { ErrorBoundaryProps, ErrorBoundaryState } from '../types';

/**
 * ErrorBoundary — Catches uncaught errors in the React component tree.
 *
 * Prevents the entire app from crashing if:
 * - Camera permission is denied
 * - MediaPipe CDN fails to load
 * - TensorFlow.js WebGL initialization fails
 * - Model file is missing or corrupt
 *
 * Provides a user-friendly fallback UI with retry option.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        this.setState({ errorInfo });
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen bg-white dark:bg-neutral-950 flex items-center justify-center p-6">
                    <div className="max-w-md text-center space-y-4">
                        <div className="text-4xl">⚠️</div>
                        <h1 className="text-xl font-semibold text-neutral-950 dark:text-white">
                            Something went wrong
                        </h1>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {this.state.error?.message || 'An unexpected error occurred.'}
                        </p>
                        <div className="text-xs text-neutral-500 dark:text-neutral-500 space-y-1">
                            <p>Common causes:</p>
                            <ul className="list-disc list-inside text-left">
                                <li>Camera permission was denied</li>
                                <li>MediaPipe failed to load (check internet)</li>
                                <li>Browser doesn't support WebGL</li>
                            </ul>
                        </div>
                        <div className="flex gap-3 justify-center pt-2">
                            <button
                                onClick={this.handleRetry}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
