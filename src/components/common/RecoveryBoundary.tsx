/**
 * Component-level recovery boundary.
 *
 * One failing panel must never take the page with it: the panel shows a small
 * inline retry, everything around it keeps working.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { label?: string; children: ReactNode; fallback?: ReactNode };
type State = { failed: boolean };

export class RecoveryBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[recovery:${this.props.label ?? "panel"}]`, error, info.componentStack);
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="rounded-lg border border-border bg-card/80 p-4 text-sm text-muted-foreground">
        <p>This panel had a problem. Your work is safe.</p>
        <button
          type="button"
          onClick={this.retry}
          className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          Reload this panel
        </button>
      </div>
    );
  }
}

export default RecoveryBoundary;
