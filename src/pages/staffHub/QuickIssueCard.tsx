import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ensureQuickIssueLink,
  regenerateQuickIssueLink,
} from "@/lib/quickIssues/api";
import { quickIssuePath, quickIssueShareUrl } from "@/lib/quickIssues/model";
import { publicOrigin } from "@/lib/public/publicSite";
import { crest, hubField, hubPrimary, hubQuiet, paper } from "@/pages/quickIssues/surface";

export function QuickIssueCard({
  orgId,
  linkOverride,
}: {
  orgId: string;
  /** Dev preview only. Production callers leave this unset. */
  linkOverride?: string;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const link = useQuery({
    queryKey: ["quick-issue-link", orgId],
    queryFn: () => ensureQuickIssueLink(orgId),
    enabled: linkOverride == null,
  });
  const token = linkOverride ?? link.data ?? "";
  const shareUrl = token ? quickIssueShareUrl(token, publicOrigin()) : "";

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("School link copied. Paste it into WhatsApp.");
    } catch {
      toast.error("Select the link and copy it.");
    }
  };

  const regenerate = async () => {
    if (
      !window.confirm(
        "The current WhatsApp link will stop working. People will need the new link.",
      )
    )
      return;
    setBusy(true);
    try {
      const next = await regenerateQuickIssueLink(orgId);
      qc.setQueryData(["quick-issue-link", orgId], next);
      toast.success("New school link ready. Copy it into WhatsApp.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The link could not be replaced.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={paper}>
      <div className={crest} />
      <header className="border-b border-dash-border bg-dash-navy/[0.03] px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-dash-navy">Quick Issue Tracker</h2>
      </header>
      <div className="p-5">
        <p className="text-sm text-dash-surface-muted">
          One link for this school. Copy it into WhatsApp. Everyone who opens it
          sees the same issues and can add new ones.
        </p>
        {linkOverride == null && link.isLoading ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-dash-surface-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Opening the school link…
          </p>
        ) : linkOverride == null && link.isError ? (
          <p className="mt-3 text-sm text-destructive">
            {link.error instanceof Error
              ? link.error.message
              : "The school link is not available yet."}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <input
              readOnly
              value={shareUrl}
              aria-label="School issue tracker link"
              className={hubField}
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={hubPrimary} onClick={() => void copy()}>
                Copy school link
              </button>
              <a href={quickIssuePath(token)} className={hubQuiet}>
                Open tracker
              </a>
              <button
                type="button"
                className={hubQuiet}
                disabled={busy}
                onClick={() => void regenerate()}
              >
                Revoke and create a new link
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
