import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ensureQuickIssueLink,
  regenerateQuickIssueLink,
} from "@/lib/quickIssues/api";
import { quickIssuePath, quickIssueShareUrl } from "@/lib/quickIssues/model";
import { publicOrigin } from "@/lib/public/publicSite";
import { btn, btnGhost, Panel } from "./ui";

export function QuickIssueCard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const link = useQuery({
    queryKey: ["quick-issue-link", orgId],
    queryFn: () => ensureQuickIssueLink(orgId),
  });
  const token = link.data ?? "";
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
    <Panel title="Quick Issue Tracker">
      <p className="text-sm text-muted-foreground">
        One link for this school. Copy it into WhatsApp. Everyone who opens it
        sees the same issues and can add new ones.
      </p>
      {link.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Opening the school link…
        </p>
      ) : link.isError ? (
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
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => void copy()}>
              Copy school link
            </button>
            <a href={quickIssuePath(token)} className={btnGhost}>
              Open tracker
            </a>
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() => void regenerate()}
            >
              Revoke and create a new link
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
