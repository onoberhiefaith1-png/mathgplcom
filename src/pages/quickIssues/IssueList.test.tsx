// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuickIssue } from "@/lib/quickIssues/api";
import { IssueList } from "./IssueList";

const issues: QuickIssue[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "First issue",
    description: "The paper tray is empty.",
    status: "not_started",
    createdByName: "Ada",
    workerName: null,
    workerAt: null,
    completerName: null,
    completedAt: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    media: [],
    history: [],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
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
        id: "33333333-3333-4333-8333-333333333333",
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
        id: "44444444-4444-4444-8444-444444444444",
        action: "completed",
        fromStatus: "in_progress",
        toStatus: "completed",
        actorName: "Bo",
        createdAt: "2026-11-01T12:00:00.000Z",
      },
    ],
  },
];

const props = {
  issues,
  busy: false,
  fileUrls: {},
  onToggle: vi.fn(),
  onStatus: vi.fn(),
  onReopen: vi.fn(),
  onDelete: vi.fn(),
  onAddLink: vi.fn(),
  onAddFile: vi.fn(),
};

afterEach(() => cleanup());

describe("issue list", () => {
  it("shows only the name and status until a row is opened", () => {
    render(<IssueList {...props} expandedId={null} canManage={false} />);
    const first = screen.getByRole("button", { name: /First issue/ });
    expect(first.textContent).toContain("First issue");
    expect(first.textContent).toContain("Not Started");
    expect(first.textContent).not.toContain("paper tray");
    expect(screen.queryByText("The paper tray is empty.")).toBeNull();
    expect(screen.queryByText(/Reopen as/)).toBeNull();
    expect(screen.queryByText("Delete issue")).toBeNull();
  });

  it("opens the remembered issue rather than the first row", () => {
    render(
      <IssueList {...props} expandedId={issues[1].id} canManage={false} />,
    );
    expect(screen.queryByText("The paper tray is empty.")).toBeNull();
    expect(screen.getByText("The side door sticks.")).toBeTruthy();
    expect(screen.getByText("Completed by Bo")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Photo" }).getAttribute("href"),
    ).toBe("https://example.com/door");
    expect(screen.getByText("Bo set Completed")).toBeTruthy();
    expect(screen.queryByText(/Reopen as/)).toBeNull();
    expect(screen.queryByRole("button", { name: "In Progress" })).toBeNull();
  });

  it("shows reopen and delete only for an owner or manager", () => {
    render(<IssueList {...props} expandedId={issues[1].id} canManage />);
    expect(
      screen.getByRole("button", { name: "Reopen as In Progress" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Reopen as Not Started" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete issue" })).toBeTruthy();
    expect(screen.getByText("Completion attachment")).toBeTruthy();
    expect(screen.queryByText(/proof/i)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Reopen as Not Started" }),
    );
    expect(props.onReopen).toHaveBeenCalledWith(issues[1].id, "not_started");
  });

  it("lets anyone mark an open issue in progress", () => {
    render(
      <IssueList {...props} expandedId={issues[0].id} canManage={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "In Progress" }));
    expect(props.onStatus).toHaveBeenCalledWith(issues[0].id, "in_progress");
    expect(screen.getByText("The paper tray is empty.")).toBeTruthy();
  });
});
