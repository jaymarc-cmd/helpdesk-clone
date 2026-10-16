import { Component, type ReactNode } from 'react';

/** Shows a recovery screen instead of a blank page if rendering ever throws (e.g. on corrupted saved data). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  reset = () => {
    try {
      localStorage.removeItem('tierone-state-v1');
    } catch {
      // Storage unavailable; reloading is still worth trying.
    }
    window.location.hash = '#/';
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Something went wrong</h1>
        <p>The simulator hit an error while loading. Resetting your saved progress in this browser usually fixes it.</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', opacity: 0.7 }}>{this.state.error.message}</pre>
        <button onClick={() => window.location.reload()} style={{ marginRight: 8 }}>
          Reload
        </button>
        <button onClick={this.reset}>Reset saved progress</button>
      </div>
    );
  }
}
