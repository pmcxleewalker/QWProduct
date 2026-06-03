import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * ErrorBoundary
 * --------------
 * Catches any uncaught render-time error from its children and shows a
 * friendly fallback instead of letting React unmount the whole tree (which
 * is what makes the screen go blank / white).
 *
 * Without this, an exception inside something like the booking-conflict UI
 * or an unexpected API payload would blank the entire app and force the
 * user to refresh.
 *
 * Usage: wrap any subtree whose crash should NOT take down the whole app.
 *
 *   <ErrorBoundary>
 *     <Bookings />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface to the console so issues are still easy to debug in DevTools.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error?.message ||
      'Something went wrong rendering this page.';

    return (
      <div
        className="min-h-[50vh] flex items-center justify-center p-6"
        data-testid="error-boundary-fallback"
      >
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl shadow-lg p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-3">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Hmm, something hiccupped.
          </h2>
          <p className="text-sm text-slate-600 mb-1">
            We hit an unexpected error while loading this view. Your data is
            safe — nothing was saved or changed.
          </p>
          <p className="text-xs text-slate-400 mb-5 font-mono break-words">
            {message}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={this.handleReset}
              data-testid="error-boundary-retry"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <RotateCcw size={14} /> Try again
            </button>
            <button
              onClick={this.handleReload}
              data-testid="error-boundary-reload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              <Home size={14} /> Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
