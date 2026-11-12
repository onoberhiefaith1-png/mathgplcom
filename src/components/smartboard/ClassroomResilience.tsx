import type { ReactNode } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { ResilientBoundary } from "@/components/common/ResilientBoundary";

/**
 * The board and the classroom audio each recover on their own. A crash in the
 * board remounts the board (it re-syncs from the class) while the audio keeps
 * playing; a crash in the audio rejoins the audio while the board stays put.
 */
export function BoardBoundary({ children }: { children: ReactNode }) {
  return (
    <ResilientBoundary
      name="smartboard-board"
      fallback={({ recovering, retry }) => (
        <div role="status" data-testid="board-recovering" className="flex h-screen w-full items-center justify-center bg-background p-6">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center text-sm">
            {recovering ? (
              <p className="flex items-center justify-center gap-2 text-muted-foreground">
                <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> Reloading the board…
              </p>
            ) : (
              <>
                <p className="font-medium text-foreground">The board hit a problem.</p>
                <p className="mt-1 text-muted-foreground">Classroom audio is still on. Reload the board to carry on.</p>
                <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">
                  <RotateCcw className="size-4" aria-hidden="true" /> Reload board
                </button>
              </>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </ResilientBoundary>
  );
}

export function AudioBoundary({ children }: { children: ReactNode }) {
  return (
    <ResilientBoundary
      name="classroom-audio"
      fallback={({ recovering, retry }) => (
        <aside aria-label="Classroom audio" data-testid="audio-recovering" className="dark fixed bottom-20 right-3 z-[200] flex items-center gap-2 rounded-full border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg">
          {recovering ? (
            <><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> Restarting audio…</>
          ) : (
            <button type="button" onClick={retry} className="inline-flex items-center gap-2 font-semibold">
              <RotateCcw className="size-4" aria-hidden="true" /> Audio stopped. Restart audio
            </button>
          )}
        </aside>
      )}
    >
      {children}
    </ResilientBoundary>
  );
}
