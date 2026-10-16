import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { asRow, DEFAULT_PASS_PERCENTAGE } from "../gameAssignments";

const base = { id: "a", game_id: "g", class_id: "c", title: "t", unassigned_at: null };

describe("pass mark default", () => {
  it("new activities default to 100%", () => {
    expect(DEFAULT_PASS_PERCENTAGE).toBe(100);
    expect(asRow({ ...base, pass_percentage: null } as never).passPercentage).toBe(100);
  });
  it("a teacher's chosen 70% is kept", () => {
    expect(asRow({ ...base, pass_percentage: 70 } as never).passPercentage).toBe(70);
  });
});
