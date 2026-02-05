import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  retry = () => {
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
