import { Component } from "react";
import type { ReactNode } from "react";

interface State {
  message: string | null;
}

/** Keeps a WebGL failure inside the stage instead of taking the editor down. */
export class WorldBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown) {
    console.error("[world]", error);
  }

  override render() {
    if (this.state.message) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0906] p-8 text-center text-sm text-amber-100/70">
          The 3D room could not start in this browser. {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
