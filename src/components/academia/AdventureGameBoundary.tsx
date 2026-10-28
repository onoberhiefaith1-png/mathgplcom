// Catches a crash inside the embedded Game so a learning point can never end
// in a blank screen: the student can retry it or skip it.
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; onSkip: () => void; resetKey?: string };
type State = { failed: boolean; attempt: number };

export default class AdventureGameBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Adventure Game could not be shown", error);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
    return (
      <div className="absolute inset-x-0 top-1/3 z-[60] mx-auto w-[min(92%,26rem)] rounded-xl border bg-background p-4 text-center shadow-lg" role="alert">
        <p className="text-sm font-medium">This learning point could not be shown.</p>
        <p className="mt-1 text-xs text-muted-foreground">Try again, or skip it and carry on.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Try again</button>
          <button type="button" onClick={this.props.onSkip} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">Skip this learning point</button>
        </div>
      </div>
    );
  }
}
