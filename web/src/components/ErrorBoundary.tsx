import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { hasError: boolean; error: Error | null };

/** True if the error is a stale asset (old CSS/chunk after deploy). Reload fixes it. */
function isStaleAssetError(error: Error): boolean {
  const msg = error?.message ?? '';
  return (
    /preload CSS|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg) ||
    /\/assets\/.*\.(css|js)/i.test(msg)
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  retry = () => {
    const { error } = this.state;
    if (error && isStaleAssetError(error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="rd-page" style={{ padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
          <div className="rd-panel" style={{ padding: '1.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
            <p className="rd-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              {this.state.error.message}
            </p>
            {isStaleAssetError(this.state.error) && (
              <p className="rd-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                A new version may be available. Reload the page to get the latest update.
              </p>
            )}
            <button type="button" className="rd-btn rd-btn-primary" onClick={this.retry}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
