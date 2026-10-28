import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Crash isolation for one feature panel.
 *
 * A failure inside Co-Pilot, Geometry, Charts, Slides or Adventure must never
 * blank the lesson. The teacher sees a small inline card with a retry action
 * and keeps working on everything else.
 */
type Props = {
  /** Shown in the card, e.g. "MathGPL Co-Pilot". */
  feature: string;
  children: ReactNode;
  /** Render nothing at all instead of a card (for decorative panels). */
  silent?: boolean;
  fallback?: ReactNode;
};

type State = { error: Error | null };

export class FeatureBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Technical detail goes to logs only — never to the teacher.
    console.error(error, info.componentStack);
    reportLovableError(error, { boundary: "feature", feature: this.props.feature });
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    if (this.props.silent) return null;

    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-sm font-medium text-foreground">{this.props.feature} couldn't load</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The rest of your work is safe and still editable.
        </p>
        <button
          type="button"
          onClick={this.retry}
          className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  }
}

export default FeatureBoundary;
