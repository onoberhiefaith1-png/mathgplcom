/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";

// The highlighted question already has its own normal Assign button.
vi.mock("@/lib/lessonnotes/assignmentEndpoints", () => ({
  assignmentEndpoints: () => [{ kind: "mcq", from: 1, at: 40 }],
}));

import { ForcedAssignMarker } from "../ForcedAssignMarker";

function fakeEditor() {
  const listeners = new Map<string, Set<() => void>>();
  const dom = document.createElement("div");
  dom.className = "lesson-doc";
  document.body.append(dom);
  const editor = {
    isDestroyed: false,
    state: {
      selection: { from: 0, to: 0, empty: true },
      doc: {
        content: { size: 100 },
        textBetween: () => "Which is prime?\nA. 9\nB. 17",
      },
    },
    view: {
      dom,
      coordsAtPos: (pos: number) => ({ top: pos * 2, bottom: pos * 2 + 16, left: 0, right: 0 }),
    },
    on: (name: string, fn: () => void) => { (listeners.get(name) ?? listeners.set(name, new Set()).get(name)!).add(fn); },
    off: (name: string, fn: () => void) => { listeners.get(name)?.delete(fn); },
    select(from: number, to: number) {
      editor.state.selection = { from, to, empty: from === to };
      listeners.get("selectionUpdate")?.forEach((fn) => fn());
    },
  };
  return { editor, dom };
}

const pointer = (type: string, target: EventTarget) =>
  target.dispatchEvent(new (window.PointerEvent ?? MouseEvent)(type, { bubbles: true }) as Event);

it("stays on screen after the highlight is released, follows it, and lets MCQ be clicked", async () => {
  (globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const { editor, dom } = fakeEditor();
  const onChoose = vi.fn();
  const marker = () => document.querySelector<HTMLElement>('[data-testid="forced-assign-marker"]');
  try {
    await act(async () => {
      root.render(<ForcedAssignMarker editor={editor as unknown as Editor} aiEditOpen={false} onChoose={onChoose} />);
    });
    expect(marker()).toBeNull();

    // Teacher drags a highlight inside the notes, then lets go.
    await act(async () => { pointer("pointerdown", dom); editor.select(5, 20); });
    expect(marker()?.dataset.phase).toBe("following");
    expect(marker()?.style.top).toBe("40px");
    await act(async () => { editor.select(5, 30); });
    expect(marker()?.style.top).toBe("60px");
    await act(async () => { pointer("pointerup", dom); });
    // Even though a normal Assign covers this question, the marker stays.
    expect(marker()?.dataset.phase).toBe("settled");

    // Pressing the marker keeps it up, even if the touch browser drops the highlight.
    await act(async () => { pointer("pointerdown", marker()!); editor.select(30, 30); pointer("pointerup", marker()!); });
    expect(marker()).not.toBeNull();
    await act(async () => { marker()!.querySelector<HTMLButtonElement>('[data-testid="forced-assign-mcq"]')!.click(); });
    expect(onChoose).toHaveBeenCalledWith("mcq", expect.objectContaining({ from: 5, to: 30 }));
    await act(async () => {});

    // A fresh highlight shows it again; clicking away in the notes removes it.
    await act(async () => { pointer("pointerdown", dom); editor.select(2, 12); pointer("pointerup", dom); });
    expect(marker()).not.toBeNull();
    await act(async () => { pointer("pointerdown", dom); editor.select(12, 12); pointer("pointerup", dom); });
    expect(marker()).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    dom.remove();
  }
});
