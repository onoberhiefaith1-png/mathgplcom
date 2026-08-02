import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { recoverFromStaleChunk } from "@/lib/router/chunkRecovery";

export function RouterErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    if (!recoverFromStaleChunk(error)) {
      reportLovableError(error, { boundary: "tanstack_router_error_component" });
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground" href="/">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}