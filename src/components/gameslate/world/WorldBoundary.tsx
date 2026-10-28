import { Component } from "react";
import type { ReactNode } from "react";

interface State {
  message: string | null;
  attempt: number;
}

const isGraphicsLoss = (message: string) =>
  /context lost|webgl|gpu|framebuffer|out of memory/i.test(message);

/** Keeps a WebGL failure inside the stage instead of taking the editor down. */
export class WorldBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { message: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown) {
    console.error("[world]", error);
  }

  private retry = () => {
    // Rebuild the stage subtree with a fresh key — never a full page reload, so
    // unsaved panel state survives.
    this.setState((prev) => ({ message: null, attempt: prev.attempt + 1 }));
  };

  override render() {
    const { message, attempt } = this.state;
    if (message) {
      const recoverable = isGraphicsLoss(message);
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b0906] p-8 text-center text-sm text-amber-100/70">
          <p>
            {recoverable
              ? "The board’s graphics view stopped. Your design is safe — bring it back below."
              : `The 3D room could not start in this browser. ${message}`}
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="rounded-full border border-amber-200/40 px-5 py-2 text-xs uppercase tracking-[0.2em] text-amber-100/90 transition hover:bg-amber-200/10"
          >
            Reload board
          </button>
        </div>
      );
    }
    return <div key={attempt} className="absolute inset-0">{this.props.children}</div>;
  }
}
