import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { WarningOctagon } from '@phosphor-icons/react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
          <div className="max-w-md text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto">
              <WarningOctagon className="w-7 h-7 text-red-600 dark:text-red-400" weight="fill" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Algo salió mal</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Se produjo un error inesperado. Recarga la página para intentarlo de nuevo.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl overflow-auto max-h-32 text-zinc-600 dark:text-zinc-400">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 bg-accent-600 hover:bg-accent-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
