import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal stand-in for React's hooks: each "component instance" owns a slot
// list, so refs persist across re-renders of that instance only.
let slots: { current: unknown }[] = [];
let cursor = 0;
let idCounter = 0;
vi.mock("react", () => ({
  useRef: (initial: unknown) => {
    const i = cursor++;
    slots[i] ??= { current: initial };
    return slots[i];
  },
  useId: () => {
    const i = cursor++;
    slots[i] ??= { current: `id${++idCounter}` };
    return slots[i].current;
  },
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
}));

type LiveOpts = {
  key: string;
  private?: boolean;
  build: (c: { on: (...a: unknown[]) => void }) => void;
  onJoined?: () => void;
};
let latest: LiveOpts;
vi.mock("../useLiveChannel", () => ({
  useLiveChannel: (opts: LiveOpts) => {
    latest = opts;
  },
}));

import { useTableChanges, type TableChangesOptions } from "../useTableChanges";

const newInstance = () => {
  slots = [];
  return (opts: TableChangesOptions) => {
    cursor = 0;
    useTableChanges(opts);
  };
};

describe("useTableChanges", () => {
  beforeEach(() => {
    slots = [];
    cursor = 0;
  });

  it("does not refetch on the first join, but does on every rejoin", () => {
    const onChange = vi.fn();
    newInstance()({ name: "class-x", watch: [{ table: "t" }], onChange });

    latest.onJoined?.(); // first join: the caller's own initial load covers it
    expect(onChange).not.toHaveBeenCalled();

    latest.onJoined?.(); // socket dropped and rejoined: catch up on what was missed
    latest.onJoined?.();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("subscribes to each watched table and calls onChange when a row changes", () => {
    const onChange = vi.fn();
    newInstance()({
      name: "class-x",
      watch: [
        { table: "a", filter: "class_id=eq.1" },
        { table: "b", event: "INSERT" },
      ],
      onChange,
    });

    const on = vi.fn();
    latest.build({ on });
    expect(on).toHaveBeenCalledTimes(2);
    expect(on.mock.calls[0][1]).toMatchObject({ table: "a", filter: "class_id=eq.1", event: "*" });
    expect(on.mock.calls[1][1]).toMatchObject({ table: "b", event: "INSERT" });

    (on.mock.calls[0][2] as () => void)();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("uses the newest onChange without resubscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const render = newInstance();
    render({ name: "n", watch: [{ table: "t" }], onChange: first });
    const on = vi.fn();
    latest.build({ on });
    render({ name: "n", watch: [{ table: "t" }], onChange: second });
    (on.mock.calls[0][2] as () => void)();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("gives two components watching the same thing different channel keys", () => {
    newInstance()({ name: "class-members-1", watch: [{ table: "t" }], onChange: vi.fn() });
    const a = latest.key;
    newInstance()({ name: "class-members-1", watch: [{ table: "t" }], onChange: vi.fn() });
    expect(latest.key).not.toBe(a);
  });

  it("keeps a private channel private and public by default", () => {
    newInstance()({ name: "j", watch: [{ table: "t" }], onChange: vi.fn(), private: true });
    expect(latest.private).toBe(true);
    newInstance()({ name: "j", watch: [{ table: "t" }], onChange: vi.fn() });
    expect(latest.private).toBe(false);
  });
});
