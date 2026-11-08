import { vi } from "vitest";
import { setupDom } from "@/test/domRender";

// Keep the production board, writer, floating controls, layout and ink renderer.
// Only external services, browser geometry and unrelated editors are stubbed.
vi.mock("@/integrations/supabase/client", () => {
  const query: any = new Proxy(() => query, {
    get: (_, key) =>
      key === "then"
        ? (resolve: any) =>
            Promise.resolve({ data: [], error: null }).then(resolve)
        : () => query,
    apply: () => query,
  });
  return {
    supabase: {
      from: () => query,
      rpc: () => query,
      channel: () => ({
        subscribe() {
          return this;
        },
        on() {
          return this;
        },
        send: vi.fn(),
        unsubscribe: vi.fn(),
      }),
      removeChannel: vi.fn(),
      auth: {
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: null } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe() {} } },
        }),
      },
    },
  };
});
vi.mock("@/lib/router-compat", () => ({
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
vi.mock("@/hooks/useNotebook", () => {
  const result = { notebook: null, sections: [], loading: false };
  return { useNotebook: () => result };
});
vi.mock("@/hooks/useSmartboardSync", () => {
  const result = {
    selfId: "student",
    incoming: null,
    activeStudentId: null,
    pushSnapshot: vi.fn(),
    setActiveStudent: vi.fn(),
    getDiagnostics: () => ({}),
  };
  return { useSmartboardSync: () => result };
});
vi.mock("@/hooks/useAssessmentBoardSession", () => ({
  useAssessmentBoardSession: () => ({
    sessionActive: false,
    loaded: true,
    incoming: null,
    push: vi.fn(),
  }),
}));
vi.mock("@/hooks/useMobileStudentBoard", () => ({
  useMobileStudentBoard: () => ({ active: true, phone: true, boardWidth: 0 }),
}));
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => "phone",
  useIsTouchLayout: () => true,
}));
vi.mock("@/hooks/useQuestionTimerAttempt", () => {
  const timer = {
    active: true,
    ready: true,
    confirmed: {},
    elapsedMs: 0,
    reset: vi.fn(),
    markInput: vi.fn(),
    complete: vi.fn(),
  };
  return {
    useQuestionTimerAttempt: () => timer,
    formatAttemptTime: () => "00:00",
  };
});
vi.mock("@/components/flow/FlowOverlay", () => ({ default: () => null }));
vi.mock("@/components/smartboard/AiEditWorkspace", () => ({
  default: () => null,
}));
vi.mock("@/components/lessonnotes/geometry3d/Workspace3DDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/lessonnotes/extensions/GeometryDiagram", () => ({
  PresentationGeometryDiagram: () => null,
}));
vi.mock("@/components/assistant/TutorGuideHost", () => ({
  default: () => null,
}));

export function boardDom() {
  const dom = setupDom();
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, String(value)),
    removeItem: (key: string) => memory.delete(key),
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("CustomEvent", window.CustomEvent);
  Object.defineProperty(window, "matchMedia", {
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // React DOM was imported before jsdom; its legacy input-event fallback needs these.
  (HTMLElement.prototype as any).attachEvent = vi.fn();
  (HTMLElement.prototype as any).detachEvent = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
  return dom;
}

export const inkText = (host: HTMLElement) =>
  [...host.querySelectorAll("[data-erase-line]")]
    .map((row) => row.textContent)
    .join("");
