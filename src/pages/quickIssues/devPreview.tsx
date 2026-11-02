import type { QuickIssue } from "@/lib/quickIssues/api";
import { Panel } from "@/pages/staffHub/ui";
import { QuickIssueCard } from "@/pages/staffHub/QuickIssueCard";

export type PreviewMode = "issues" | "empty" | "card";

/** Local `vite dev` only. Production builds drop the call site. */
export function readPreview(): PreviewMode | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("preview");
  if (value === "issues" || value === "empty" || value === "card") return value;
  return null;
}

export const PREVIEW_OPEN_ID = "22222222-2222-4222-8222-222222222222";
const PREVIEW_IMAGE_ID = "55555555-5555-4555-8555-555555555555";

const previewImage =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
      <rect width="100%" height="100%" fill="#f4f7fb"/>
      <rect x="20" y="20" width="600" height="320" rx="16" fill="#ffffff" stroke="#d5dbe6"/>
      <text x="320" y="188" text-anchor="middle" fill="#1c2740" font-family="Georgia,serif" font-size="28">Room 12 whiteboard</text>
    </svg>`,
  );

export function previewFileUrls(): Record<string, string> {
  return { [PREVIEW_IMAGE_ID]: previewImage };
}

export function previewIssues(): QuickIssue[] {
  return [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Projector cable",
      description: "The hall projector loses the signal halfway through the lesson.",
      status: "not_started",
      createdByName: "Ada",
      workerName: null,
      workerAt: null,
      completerName: null,
      completedAt: null,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
      media: [],
      history: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          action: "created",
          fromStatus: null,
          toStatus: "not_started",
          actorName: "Ada",
          createdAt: "2026-11-01T10:00:00.000Z",
        },
      ],
    },
    {
      id: PREVIEW_OPEN_ID,
      name: "Whiteboard pens",
      description: "The blue pens in Room 12 have dried out. A fresh box is in the office cupboard.",
      status: "in_progress",
      createdByName: "Ada",
      workerName: "Ada",
      workerAt: "2026-11-01T11:00:00.000Z",
      completerName: null,
      completedAt: null,
      createdAt: "2026-11-01T10:30:00.000Z",
      updatedAt: "2026-11-01T11:00:00.000Z",
      media: [
        {
          id: PREVIEW_IMAGE_ID,
          role: "issue",
          kind: "image",
          label: "Dried pens",
          url: null,
          mime: "image/svg+xml",
          byteSize: 420,
          createdByName: "Ada",
          createdAt: "2026-11-01T10:40:00.000Z",
        },
        {
          id: "77777777-7777-4777-8777-777777777777",
          role: "issue",
          kind: "link",
          label: "Cupboard list",
          url: "https://example.com/cupboard",
          mime: null,
          byteSize: null,
          createdByName: "Ada",
          createdAt: "2026-11-01T10:42:00.000Z",
        },
      ],
      history: [
        {
          id: "88888888-8888-4888-8888-888888888888",
          action: "in_progress",
          fromStatus: "not_started",
          toStatus: "in_progress",
          actorName: "Ada",
          createdAt: "2026-11-01T11:00:00.000Z",
        },
      ],
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Door lock",
      description: "The side door sticks.",
      status: "completed",
      createdByName: "Bo",
      workerName: "Bo",
      workerAt: "2026-11-01T11:00:00.000Z",
      completerName: "Bo",
      completedAt: "2026-11-01T12:00:00.000Z",
      createdAt: "2026-11-01T11:00:00.000Z",
      updatedAt: "2026-11-01T12:00:00.000Z",
      media: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          role: "issue",
          kind: "link",
          label: "Photo",
          url: "https://example.com/door",
          mime: null,
          byteSize: null,
          createdByName: "Bo",
          createdAt: "2026-11-01T11:05:00.000Z",
        },
      ],
      history: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          action: "completed",
          fromStatus: "in_progress",
          toStatus: "completed",
          actorName: "Bo",
          createdAt: "2026-11-01T12:00:00.000Z",
        },
      ],
    },
  ];
}

/** Staff Hub neighbours, so the light card can be checked beside real panels. */
export function CardPreview() {
  const token = "ab".repeat(32);
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Panel title="Status board">
          <p className="text-sm text-muted-foreground">Assigned work for this school.</p>
        </Panel>
        <QuickIssueCard orgId="00000000-0000-4000-8000-000000000001" linkOverride={token} />
        <Panel title="Coming up">
          <p className="text-sm text-muted-foreground">No deadlines coming up.</p>
        </Panel>
      </div>
    </div>
  );
}
