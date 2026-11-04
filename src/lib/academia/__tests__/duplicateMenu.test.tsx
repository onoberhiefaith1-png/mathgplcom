// @vitest-environment node
import { act, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { duplicate, success, failure, invalidate, navigate } = vi.hoisted(() => ({
  duplicate: vi.fn(), success: vi.fn(), failure: vi.fn(), invalidate: vi.fn(), navigate: vi.fn(),
}));
vi.mock("@/lib/academia/duplication", () => ({ duplicateAcademiaBranch: duplicate }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: invalidate }) }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("sonner", () => ({ toast: { success, error: failure } }));
vi.mock("@/components/ui/dropdown-menu", async () => {
  const React = await import("react");
  const Context = React.createContext({ open: false, set: (_open: boolean) => {} });
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => {
      const [open, set] = React.useState(false);
      return <Context.Provider value={{ open, set }}>{children}</Context.Provider>;
    },
    DropdownMenuTrigger: ({ children, ...props }: any) => {
      const menu = React.useContext(Context);
      return <button {...props} onClick={() => menu.set(!menu.open)}>{children}</button>;
    },
    DropdownMenuContent: ({ children, ...props }: any) => {
      const menu = React.useContext(Context);
      return menu.open ? <div {...props} role="menu">{children}</div> : null;
    },
    DropdownMenuItem: ({ children, onSelect, ...props }: any) => {
      const menu = React.useContext(Context);
      return <button {...props} role="menuitem" onClick={event => { onSelect?.(event); if (!event.defaultPrevented) menu.set(false); }}>{children}</button>;
    },
  };
});
import AcademiaDuplicateMenu from "../../../components/academia/AcademiaDuplicateMenu";
import SubjectMenu from "../../../components/academia/mcq/SubjectMenu";

// Self-contained DOM fixture; does not depend on a workstation test config.
const ownedDom = typeof document === "undefined"
  ? new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mathgpl.com", pretendToBeVisual: true }) : null;
if (ownedDom) {
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "KeyboardEvent", "CustomEvent"]) {
    Object.defineProperty(globalThis, name, { value: (ownedDom.window as any)[name], configurable: true, writable: true });
  }
}
const { createRoot } = await import("react-dom/client");
afterAll(() => ownedDom?.window.close());

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  duplicate.mockReset().mockResolvedValue({ id: "copy", kind: "session", name: "Introduction duplicate", counts: {} });
  success.mockReset(); failure.mockReset(); navigate.mockReset(); invalidate.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (node: ReactNode) => { await act(async () => root.render(node)); };
const click = async (node: Element | null) => {
  expect(node).not.toBeNull(); await act(async () => { (node as HTMLElement).click(); await Promise.resolve(); });
};

describe("Academia three-dot menus", () => {
  it.each(["class", "subject", "topic", "subtopic", "session"] as const)("duplicates the chosen %s without opening the card", async kind => {
    const openCard = vi.fn();
    await render(<div onClick={openCard}><AcademiaDuplicateMenu kind={kind} id={`chosen-${kind}`} name="Introduction" /></div>);
    await click(host.querySelector("button"));
    expect(openCard).not.toHaveBeenCalled();
    await click(host.querySelector('[role="menuitem"]'));
    expect(duplicate).toHaveBeenCalledWith(kind, `chosen-${kind}`);
    expect(openCard).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledTimes(1);
  });
  it("disables another click while the copy is being created", async () => {
    let finish!: (result: unknown) => void;
    duplicate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render(<AcademiaDuplicateMenu kind="session" id="pending" name="Introduction" />);
    await click(host.querySelector("button"));
    await click(host.querySelector('[role="menuitem"]'));
    const item = host.querySelector('[role="menuitem"]') as HTMLButtonElement;
    expect(item.disabled).toBe(true); expect(item.textContent).toContain("Duplicating");
    await click(item); expect(duplicate).toHaveBeenCalledTimes(1);
    await act(async () => finish({ id: "copy", name: "Introduction duplicate", counts: {} }));
  });
  it("keeps View Questions and Duplicate together in the original subject menu", async () => {
    const openCard = vi.fn();
    await render(<div onClick={openCard}><SubjectMenu subjectId="maths" duplicateName="Mathematics" /></div>);
    expect(host.querySelectorAll("button").length).toBe(1);
    await click(host.querySelector("button"));
    expect(host.querySelectorAll('[role="menuitem"]').length).toBe(2);
    await click([...host.querySelectorAll('[role="menuitem"]')].find(n => n.textContent?.includes("View Questions")) ?? null);
    expect(navigate).toHaveBeenCalledWith({ to: "/mcq/subject/$subjectId", params: { subjectId: "maths" } });
    expect(duplicate).not.toHaveBeenCalled(); expect(openCard).not.toHaveBeenCalled();
  });
  it("does not expose author duplication in a read-only subject menu", async () => {
    await render(<SubjectMenu subjectId="read-only" />); await click(host.querySelector("button"));
    expect(host.textContent).not.toContain("Duplicate"); expect(host.textContent).toContain("View Questions");
  });
  it("shows failure without claiming a partial copy succeeded and permits retry", async () => {
    duplicate.mockRejectedValue(new Error("A linked lesson note is private."));
    await render(<AcademiaDuplicateMenu kind="topic" id="denied" name="Algebra" />);
    await click(host.querySelector("button")); await click(host.querySelector('[role="menuitem"]'));
    expect(failure).toHaveBeenCalledWith("A linked lesson note is private."); expect(success).not.toHaveBeenCalled();
    expect((host.querySelector('[role="menuitem"]') as HTMLButtonElement).disabled).toBe(false);
  });
  it("does not report a committed copy as failed when only cache refresh fails", async () => {
    invalidate.mockRejectedValue(new Error("refresh unavailable"));
    await render(<AcademiaDuplicateMenu kind="subtopic" id="refresh" name="Equations" />);
    await click(host.querySelector("button")); await click(host.querySelector('[role="menuitem"]'));
    expect(success).toHaveBeenCalledTimes(1); expect(failure).not.toHaveBeenCalled();
  });
});
