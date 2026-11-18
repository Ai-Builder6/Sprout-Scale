import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let parsedSummary = this.state.errorMessage;
    try {
      const parsed = JSON.parse(this.state.errorMessage) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        parsedSummary = `${parsed.error}${parsed.path ? ` (Path: ${parsed.path}, Action: ${parsed.operationType ?? 'unknown'})` : ''}`;
      }
    } catch {
      // Plain error message string
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3 text-amber-700">
            <AlertTriangle className="w-6 h-6 shrink-0" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-900">Something interrupted SproutScale</h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{parsedSummary}</p>
          <div className="pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Reset View
            </button>
          </div>
        </div>
      </div>
    );
  }
}
