// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const relay = vi.hoisted(() => ({ connect: vi.fn() }));
const mic = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }), getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }) } } }));
vi.mock("@/lib/classroomAudio/connectRelay", () => ({ connectClassroomRelay: relay.connect }));
vi.mock("@/lib/classroomAudio/request", () => ({
  ClassroomAudioError: class extends Error { code = "not_connected"; },
  requestClassroomAudio: vi.fn(async () => ({ url: "wss://x", token: "t" })),
}));
// A plain stand-in for the Radix popover: open when "open" is true, toggled by the trigger.
vi.mock("@/components/ui/popover", async () => {
  const React = await import("react");
  const Ctx = React.createContext<{ open: boolean; set: (v: boolean) => void }>({ open: false, set: () => {} });
  return {
    Popover: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) =>
      React.createElement(Ctx.Provider, { value: { open, set: onOpenChange } }, children),
    PopoverTrigger: ({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) => {
      const ctx = React.useContext(Ctx);
      return React.cloneElement(children, { onClick: () => ctx.set(!ctx.open) });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) => {
      const ctx = React.useContext(Ctx);
      return ctx.open ? React.createElement("div", { role: "dialog" }, children) : null;
    },
  };
});
vi.mock("@/lib/classroomAudio/permission", () => ({ captureMicrophone: mic.capture, stopMicrophoneStream: vi.fn() }));

import { ClassroomAudio } from "@/components/smartboard/ClassroomAudio";

let root: Root;
let host: HTMLElement;
const fakeConnection = () => ({
  enableSound: vi.fn(async () => undefined),
  waitUntilCanPublish: vi.fn(async () => undefined),
  publishMicrophone: vi.fn(async () => undefined),
  stopMicrophone: vi.fn(async () => undefined),
  close: vi.fn(),
});
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const mount = async (teacher: boolean) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<ClassroomAudio classId="c1" teacher={teacher} />); await flush(); });
};
const phase = () => document.querySelector("aside")?.getAttribute("data-audio-phase");
const byTest = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = async (el: HTMLElement | null) => { await act(async () => { el!.click(); await flush(); }); };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  relay.connect.mockReset();
  mic.capture.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("classroom audio joins like a call app", () => {
  it("connects nothing and asks for nothing until Join is tapped", async () => {
    await mount(false);
    expect(phase()).toBe("idle");
    expect(byTest("audio-pill")?.textContent).toContain("Join audio");
    expect(relay.connect).not.toHaveBeenCalled();
    expect(mic.capture).not.toHaveBeenCalled();
  });
  it("Listen only connects without asking for the microphone", async () => {
    relay.connect.mockResolvedValue(fakeConnection());
    await mount(false);
    await click(byTest("audio-pill"));
    await click(byTest("audio-join-listen"));
    expect(mic.capture).not.toHaveBeenCalled();
    expect(relay.connect).toHaveBeenCalledTimes(1);
    expect(phase()).toBe("connected");
  });
  it("Join with microphone asks first (Allow microphone…), then connects", async () => {
    let grant!: (s: MediaStream) => void;
    mic.capture.mockReturnValue(new Promise<MediaStream>((r) => { grant = r; }));
    relay.connect.mockResolvedValue(fakeConnection());
    await mount(false);
    await click(byTest("audio-pill"));
    await click(byTest("audio-join-mic"));
    expect(mic.capture).toHaveBeenCalledTimes(1);
    expect(phase()).toBe("requesting");
    expect(relay.connect).not.toHaveBeenCalled();
    await act(async () => { grant({ getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream); await flush(); });
    expect(relay.connect).toHaveBeenCalledTimes(1);
    expect(phase()).toBe("connected");
  });
  it("the teacher's microphone is published as soon as the room connects", async () => {
    const conn = fakeConnection();
    mic.capture.mockResolvedValue({ getTracks: () => [], getAudioTracks: () => [] });
    relay.connect.mockResolvedValue(conn);
    await mount(true);
    await click(byTest("audio-pill"));
    await click(byTest("audio-join-mic"));
    await act(async () => { await flush(); });
    expect(conn.publishMicrophone).toHaveBeenCalledTimes(1);
  });
  it("a denied microphone shows how to allow it, with Try again and Listen only, and does not connect", async () => {
    mic.capture.mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    await mount(false);
    await click(byTest("audio-pill"));
    await click(byTest("audio-join-mic"));
    expect(phase()).toBe("denied");
    expect(byTest("audio-denied")?.textContent).toContain("Microphone blocked");
    expect(byTest("audio-denied")?.textContent).toContain("Listen only");
    expect(relay.connect).not.toHaveBeenCalled();
  });
  it("the server key error reads as a setup problem with Reconnect and the raw text tucked away", async () => {
    relay.connect.mockRejectedValue(new Error("could not establish signal connection: invalid authorization token: token signature is invalid: signature is invalid"));
    await mount(false);
    await click(byTest("audio-pill"));
    await click(byTest("audio-join-listen"));
    expect(phase()).toBe("error");
    const box = byTest("audio-error")!;
    expect(box.textContent).toContain("The audio server refused the connection");
    expect(box.querySelector("details")?.textContent).toContain("signature is invalid");
    expect(byTest("audio-reconnect")).not.toBeNull();
    relay.connect.mockResolvedValue(fakeConnection());
    await click(byTest("audio-reconnect"));
    expect(relay.connect).toHaveBeenCalledTimes(2);
    expect(phase()).toBe("connected");
  });
  it("Leave audio disconnects and returns to Join audio", async () => {
    const conn = fakeConnection();
    relay.connect.mockResolvedValue(conn);
    await mount(false);
    await click(byTest("audio-pill"));
    await click(byTest("audio-join-listen"));
    // The panel stays open after joining, showing Connected; Leave is in it.
    expect(byTest("audio-status")?.textContent).toContain("Connected");
    await click(byTest("audio-leave"));
    expect(conn.close).toHaveBeenCalled();
    expect(phase()).toBe("idle");
  });
});
