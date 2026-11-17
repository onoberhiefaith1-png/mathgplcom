// @vitest-environment node
import { act, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/academia/duplication", () => ({ duplicateAcademiaBranch: vi.fn() }));
vi.mock("@/lib/academia/api", () => ({ renameAcademiaItem: vi.fn(), deleteAcademiaItem: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
const navigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

import { AcademiaCatalogRowMenu } from "../../../components/academia/AcademiaCatalogRowMenu";
import { Column } from "../../../pages/academia/SchoolAcademiaPage";
import { CatalogBoard } from "../../../pages/academiaApp/AcademiaAppCatalog";
import { canManageAcademiaItem } from "../itemPermissions";

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
  navigate.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (node: ReactNode) => { await act(async () => root.render(node)); };

const teacherId = "teacher-1";
const items = {
  class: { id: "c1", name: "Year 7", created_by: null },
  subject: { id: "s1", name: "Maths", created_by: null },
  ownTopic: { id: "t-own", name: "My topic", created_by: teacherId },
  otherTopic: { id: "t-other", name: "Other topic", created_by: "someone-else" },
  ownSession: { id: "se-own", title: "My session", created_by: teacherId },
  otherSession: { id: "se-other", title: "Other session", created_by: "someone-else" },
};

function menus(role: "school" | "teacher") {
  const userId = role === "teacher" ? teacherId : "owner";
  const isOrgOwner = role === "school";
  return (
    <div>
      <AcademiaCatalogRowMenu kind="class" item={items.class} userId={userId} isOrgOwner={isOrgOwner} />
      <AcademiaCatalogRowMenu kind="subject" item={items.subject} userId={userId} isOrgOwner={isOrgOwner} />
      <AcademiaCatalogRowMenu kind="topic" item={items.ownTopic} userId={userId} isOrgOwner={isOrgOwner} />
      <AcademiaCatalogRowMenu kind="topic" item={items.otherTopic} userId={userId} isOrgOwner={isOrgOwner} />
      <AcademiaCatalogRowMenu kind="session" item={items.ownSession} userId={userId} isOrgOwner={isOrgOwner} />
      <AcademiaCatalogRowMenu kind="session" item={items.otherSession} userId={userId} isOrgOwner={isOrgOwner} />
    </div>
  );
}

describe("school vs teacher catalog menus", () => {
  it("lets the school see the ⋯ menu on every item", async () => {
    await render(menus("school"));
    const dots = [...host.querySelectorAll("[data-academia-item-menu]")];
    expect(dots.map(el => el.getAttribute("data-academia-item-menu"))).toEqual([
      "class", "subject", "topic", "topic", "session", "session",
    ]);
  });
  it("lets a teacher see the ⋯ menu only on topics, subtopics and sessions they created", async () => {
    await render(menus("teacher"));
    const dots = [...host.querySelectorAll("[data-academia-item-menu]")];
    expect(dots.map(el => `${el.getAttribute("data-academia-item-menu")}:${(el as HTMLElement).getAttribute("aria-label")}`)).toEqual([
      "topic:Topic settings for My topic",
      "session:Session settings for My session",
    ]);
    expect(canManageAcademiaItem({ kind: "class", isOrgOwner: false, userId: teacherId, createdBy: teacherId })).toBe(false);
    expect(canManageAcademiaItem({ kind: "subject", isOrgOwner: false, userId: teacherId })).toBe(false);
  });
  it("keeps View Questions as a separate control on subjects, even when a teacher has no ⋯ menu", async () => {
    await render(menus("teacher"));
    expect(host.querySelector("[data-academia-view-questions]")).not.toBeNull();
    expect(host.querySelector('[data-academia-item-menu="subject"]')).toBeNull();
    await act(async () => { (host.querySelector("[data-academia-view-questions]") as HTMLButtonElement).click(); });
    expect(navigate).toHaveBeenCalledWith({ to: "/mcq/subject/$subjectId", params: { subjectId: "s1" } });
  });
});

describe("catalog columns have no standalone delete", () => {
  it("renders the shared menu and never a row-level Remove button", async () => {
    await render(
      <Column
        title="Topics"
        items={[{ id: "t-own", name: "My topic" }, { id: "t-other", name: "Other topic" }]}
        selected={null}
        empty="none"
        menu={id => <AcademiaCatalogRowMenu kind="topic" item={id === "t-own" ? items.ownTopic : items.otherTopic} userId={teacherId} isOrgOwner={false} />}
      />,
    );
    expect(host.querySelector('[aria-label^="Remove "]')).toBeNull();
    expect(host.querySelector("[data-academia-item-menu]")).not.toBeNull();
    expect(host.textContent).not.toMatch(/\bDelete\b/);
  });
});

describe("the Academia app catalog uses the same permission logic", () => {
  it("renders CatalogBoard with shared row menus and no standalone delete", async () => {
    const noop = () => {};
    await render(
      <CatalogBoard
        heading="My Academia"
        note="app"
        userId={teacherId}
        isOrgOwner={false}
        classes={[items.class]}
        subjects={[items.subject]}
        topics={[items.ownTopic, items.otherTopic]}
        subtopics={[]}
        sessions={[items.ownSession, items.otherSession]}
        drill={{
          classId: "c1", subjectId: "s1", topicId: null, subtopicId: null, sessionId: null,
          selectClass: noop, selectSubject: noop, selectTopic: noop, selectSubtopic: noop,
        }}
        onOpenSession={noop}
      />,
    );
    expect(host.querySelector("[data-academia-app-catalog]")).not.toBeNull();
    const dots = [...host.querySelectorAll("[data-academia-item-menu]")].map(el => el.getAttribute("aria-label"));
    expect(dots).toEqual(["Topic settings for My topic", "Session settings for My session"]);
    expect(host.querySelector('[aria-label^="Remove "]')).toBeNull();
    expect(host.querySelector("[data-academia-view-questions]")).not.toBeNull();
  });
});
