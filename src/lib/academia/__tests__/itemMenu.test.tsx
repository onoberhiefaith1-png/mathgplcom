// @vitest-environment node
import { act, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { duplicate, rename, remove, success, failure, invalidate, navigate, confirmFn } = vi.hoisted(() => ({
  duplicate: vi.fn(), rename: vi.fn(), remove: vi.fn(), success: vi.fn(), failure: vi.fn(),
  invalidate: vi.fn(), navigate: vi.fn(), confirmFn: vi.fn(),
}));
vi.mock("@/lib/academia/duplication", () => ({ duplicateAcademiaBranch: duplicate }));
vi.mock("@/lib/academia/api", () => ({ renameAcademiaItem: rename, deleteAcademiaItem: remove }));
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
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div role="dialog">{children}</div> : null),
    DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  };
});

import AcademiaItemMenu from "../../../components/academia/AcademiaItemMenu";

const ownedDom = typeof document === "undefined"
  ? new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mathgpl.com", pretendToBeVisual: true }) : null;
if (ownedDom) {
  for (const name of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "Element", "Node", "Event", "MouseEvent", "KeyboardEvent", "CustomEvent"]) {
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
  duplicate.mockReset().mockResolvedValue({ id: "copy", kind: "topic", name: "Algebra duplicate", counts: {} });
  rename.mockReset().mockResolvedValue(undefined);
  remove.mockReset().mockResolvedValue(undefined);
  success.mockReset(); failure.mockReset(); navigate.mockReset();
  invalidate.mockReset().mockResolvedValue(undefined);
  confirmFn.mockReset().mockReturnValue(true);
  vi.stubGlobal("confirm", confirmFn);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async (node: ReactNode) => { await act(async () => root.render(node)); };
const click = async (node: Element | null) => {
  expect(node).not.toBeNull(); await act(async () => { (node as HTMLElement).click(); await Promise.resolve(); });
};
const item = (label: string) => [...host.querySelectorAll('[role="menuitem"]')].find(n => n.textContent?.includes(label)) ?? null;
const labels = () => [...host.querySelectorAll('[role="menuitem"]')].map(n => n.textContent?.replace(/\s+/g, " ").trim());
const setInput = async (el: HTMLInputElement, value: string) => {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  desc?.set?.call(el, value);
  await act(async () => { el.dispatchEvent(new Event("input", { bubbles: true })); });
};

describe("Academia settings menu permissions", () => {
  it("shows Rename, Duplicate and Delete to the school owner", async () => {
    await render(<AcademiaItemMenu kind="topic" id="t1" name="Algebra" createdBy="teacher" isOrgOwner showDuplicate />);
    await click(host.querySelector("button"));
    expect(labels()).toEqual(["Rename", "Duplicate", "Delete"]);
  });
  it("shows Rename, Duplicate and Delete to the teacher who created the item", async () => {
    await render(<AcademiaItemMenu kind="session" id="s1" name="Introduction" createdBy="t1" userId="t1" showDuplicate />);
    await click(host.querySelector("button"));
    expect(labels()).toEqual(["Rename", "Duplicate", "Delete"]);
  });
  it("hides Rename and Delete from an assigned teacher who did not create the item", async () => {
    const openCard = vi.fn();
    await render(<div onClick={openCard}><AcademiaItemMenu kind="topic" id="t1" name="Algebra" createdBy="t1" userId="t2" showDuplicate /></div>);
    await click(host.querySelector("button"));
    expect(labels()).toEqual(["Duplicate"]);
    expect(openCard).not.toHaveBeenCalled();
  });
  it("keeps View Questions with Duplicate on a subject, and Rename for the owner", async () => {
    await render(<AcademiaItemMenu kind="subject" id="maths" name="Mathematics" isOrgOwner showDuplicate />);
    await click(host.querySelector("button"));
    expect(labels()).toEqual(["Rename", "View Questions", "Duplicate", "Delete"]);
    await click(item("View Questions"));
    expect(navigate).toHaveBeenCalledWith({ to: "/mcq/subject/$subjectId", params: { subjectId: "maths" } });
  });
  it("does not render a class menu for a teacher who cannot manage or duplicate it", async () => {
    await render(<AcademiaItemMenu kind="class" id="c1" name="Year 7" userId="t1" />);
    expect(host.querySelector("button")).toBeNull();
  });
});

describe("Academia rename and delete flow", () => {
  it("rejects a blank name without calling the API", async () => {
    await render(<AcademiaItemMenu kind="topic" id="t1" name="Algebra" userId="t1" createdBy="t1" />);
    await click(host.querySelector("button"));
    await click(item("Rename"));
    const input = host.querySelector("input") as HTMLInputElement;
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await setInput(input, "   ");
    await click([...host.querySelectorAll("button")].find(b => b.textContent?.includes("Save")) ?? null);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Enter a name");
    expect(rename).not.toHaveBeenCalled();
  });
  it("trims a valid name and saves it without opening the card", async () => {
    const openCard = vi.fn();
    await render(<div onClick={openCard}><AcademiaItemMenu kind="subtopic" id="u1" name="Equations" userId="t1" createdBy="t1" /></div>);
    await click(host.querySelector("button"));
    await click(item("Rename"));
    const input = host.querySelector("input") as HTMLInputElement;
    await setInput(input, "  Linear equations  ");
    await click([...host.querySelectorAll("button")].find(b => b.textContent?.includes("Save")) ?? null);
    expect(rename).toHaveBeenCalledWith("subtopic", "u1", "Linear equations");
    expect(success).toHaveBeenCalledTimes(1);
    expect(openCard).not.toHaveBeenCalled();
  });
  it("deletes after confirm", async () => {
    await render(<AcademiaItemMenu kind="topic" id="t1" name="Algebra" isOrgOwner />);
    await click(host.querySelector('[aria-label="Topic settings for Algebra"]'));
    await click(item("Delete"));
    expect(confirmFn).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("topic", "t1");
  });
  it("does not delete when confirm is cancelled", async () => {
    confirmFn.mockReturnValue(false);
    await render(<AcademiaItemMenu kind="topic" id="t1" name="Algebra" isOrgOwner />);
    await click(host.querySelector('[aria-label="Topic settings for Algebra"]'));
    await click(item("Delete"));
    expect(confirmFn).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it("duplicates from the same menu without selecting the card", async () => {
    const openCard = vi.fn();
    await render(<div onClick={openCard}><AcademiaItemMenu kind="topic" id="t1" name="Algebra" userId="t2" createdBy="t1" showDuplicate /></div>);
    await click(host.querySelector("button"));
    await click(item("Duplicate"));
    expect(duplicate).toHaveBeenCalledWith("topic", "t1");
    expect(openCard).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledTimes(1);
  });
});
