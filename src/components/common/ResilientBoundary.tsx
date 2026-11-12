import { Component, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { recordClientError } from "@/lib/diagnostics/clientErrors";

type Props = {
  /** Names the part of the page in the crash record, e.g. "smartboard-board". */
  name: string;
  children: ReactNode;
  /** Shown while recovering, and after recovery gives up (with a Retry). */
  fallback?: (state: { recovering: boolean; retry: () => void; message: string }) => ReactNode;
  /** Automatic remounts allowed per minute before showing the fallback with Retry. Default 3. */
  maxAutoRetries?: number;
  /** Delay before an automatic remount, in ms. Default 1500. */
  retryDelayMs?: number;
};

type State = { failed: boolean; message: string; generation: number; recovering: boolean };

/**
 * Keeps one part of a page from taking the whole page down. A crash inside it
 * is recorded and reported, then that part alone is remounted (fresh state),
 * a few times a minute, while the rest of the page keeps running. In a class,
 * a board crash no longer ends the classroom audio, and the other way round.
 */
export class ResilientBoundary extends Component<Props, State> {
  state: State = { failed: false, message: "", generation: 0, recovering: false };
  private failures: number[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { failed: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    recordClientError(error, this.props.name);
    reportLovableError(error, { boundary: this.props.name });
    const now = Date.now();
    this.failures = [...this.failures.filter((t) => now - t < 60_000), now];
    const limit = this.props.maxAutoRetries ?? 3;
    if (this.failures.length <= limit) {
      this.setState({ recovering: true });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.retry(), this.props.retryDelayMs ?? 1500);
    } else {
      this.setState({ recovering: false });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  retry = () => {
    clearTimeout(this.timer);
    this.setState((s) => ({ failed: false, recovering: false, message: "", generation: s.generation + 1 }));
  };

  render() {
    if (this.state.failed) {
      return this.props.fallback?.({ recovering: this.state.recovering, retry: this.retry, message: this.state.message }) ?? null;
    }
    // A new key remounts the children with fresh state after a crash.
    return <ResilientChildren key={this.state.generation}>{this.props.children}</ResilientChildren>;
  }
}

function ResilientChildren({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
