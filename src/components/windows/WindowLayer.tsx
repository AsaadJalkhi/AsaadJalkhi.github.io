/**
 * Renders every open window. Each app is wrapped in an error boundary so one
 * misbehaving app cannot take down the whole desktop.
 */
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { useOs } from '@/state/os';
import { APPS } from './registry';
import { WindowShell } from './Window';
import { Empty } from '@/components/ui/Ui';

export function WindowLayer() {
  const windows = useOs((state) => state.windows);

  return (
    <div className="window-layer">
      {windows.map((win) => {
        const app = APPS[win.app];
        const AppBody = app.component;
        return (
          <WindowShell key={win.id} win={win}>
            <AppBoundary title={win.title}>
              <Suspense fallback={<div className="win-pad mono">Loading…</div>}>
                <AppBody win={win} />
              </Suspense>
            </AppBoundary>
          </WindowShell>
        );
      })}
    </div>
  );
}

interface BoundaryState {
  error: Error | null;
}

class AppBoundary extends Component<{ title: string; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the detail available for debugging without breaking the desktop.
    console.error(`[ASAAD.OS] "${this.props.title}" crashed`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Empty
          title={`${this.props.title} could not open`}
          hint={this.state.error.message || 'Close this window and try again.'}
        />
      );
    }
    return this.props.children;
  }
}
