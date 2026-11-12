import { useEffect } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { recoverFromStaleChunk } from "@/lib/router/chunkRecovery";
import { recordClientError, safeErrorMessage } from "@/lib/diagnostics/clientErrors";

export function RouterErrorBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => {
    if (!recoverFromStaleChunk(error)) {
      recordClientError(error, "page");
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
        {/* What failed, so a screenshot of this page is enough to find the cause. */}
        <details className="mt-5 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer text-center">Technical details</summary>
          <p data-testid="error-details" className="mt-2 break-words rounded-md bg-muted/40 p-2 font-mono">
            {safeErrorMessage(error)}
            <br />
            {typeof window !== "undefined" ? window.location.pathname : ""} · {new Date().toLocaleString()}
          </p>
        </details>
      </div>
    </div>
  );
}