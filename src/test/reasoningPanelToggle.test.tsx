// Teacher "View Student Work" — the Reasoning button must open a right-side
// panel that SHRINKS the smartboard (side-by-side flex), never overlays it.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({
      data: { id: "a1", title: "Test", questions: [], notebook_id: "n1" },
      error: null,
    }),
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "t1" } } }) },
      from: () => chain,
      rpc: async () => ({ data: [{ user_id: "s1", display_name: "Ada" }] }),
    },
  };
});

vi.mock("@/lib/classes/ensureClassOwner", () => ({
  ensureClassOwner: async () => null,
}));

vi.mock("@/components/smartboard/PresentationView", () => ({
  default: () => <div data-testid="board">board</div>,
}));

vi.mock("@/components/smartboard/TeacherReasoningPanel", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="reasoning-panel">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

vi.mock("@/lib/assessments/assessmentBoardSource", () => ({
  buildAssessmentBoardSource: () => ({ questions: [] }),
}));

import TeacherAssessmentViewerPage from "@/pages/class/TeacherAssessmentViewerPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/teaching-hub/classes/c1/assessments/a1/student/s1"]}>
      <Routes>
        <Route
          path="/teaching-hub/classes/:classId/assessments/:assessmentId/student/:studentId"
          element={<TeacherAssessmentViewerPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("Reasoning side panel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is closed by default and opens on click, then closes again", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("board")).toBeInTheDocument());
    expect(screen.queryByTestId("reasoning-panel")).toBeNull();

    fireEvent.click(screen.getByTitle(/Mathematical Reasoning/i));
    await waitFor(() => expect(screen.getByTestId("reasoning-panel")).toBeInTheDocument());

    fireEvent.click(screen.getByText("close"));
    await waitFor(() => expect(screen.queryByTestId("reasoning-panel")).toBeNull());
  });

  it("shrinks the board instead of overlaying it (20% flex column)", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("board")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle(/Mathematical Reasoning/i));
    await waitFor(() => expect(screen.getByTestId("reasoning-panel")).toBeInTheDocument());

    const panelWrap = screen.getByTestId("reasoning-panel").parentElement!;
    const boardWrap = screen.getByTestId("board").parentElement!;
    const row = boardWrap.parentElement!;

    // Same flex row => side by side, no overlay.
    expect(panelWrap.parentElement).toBe(row);
    expect(row.className).toContain("flex");
    expect(panelWrap.className).toContain("w-[20%]");
    expect(panelWrap.className).toContain("flex-none");
    expect(boardWrap.className).toContain("flex-1");
    // No absolute/fixed positioning on the panel column.
    expect(panelWrap.className).not.toMatch(/absolute|fixed/);
  });
});
