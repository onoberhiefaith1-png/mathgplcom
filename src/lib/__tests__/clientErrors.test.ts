// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CLIENT_ERRORS_KEY, readClientErrors, recordClientError, safeErrorMessage } from "@/lib/diagnostics/clientErrors";

describe("client error records", () => {
  it("never keeps tokens or secrets", () => {
    const msg = safeErrorMessage(new Error("fetch failed Authorization: Bearer abc.def.ghi token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig api_secret=s3cr3t"));
    expect(msg).not.toMatch(/abc\.def\.ghi|eyJhbGci|s3cr3t/);
  });
  it("keeps the latest five on the device", () => {
    localStorage.removeItem(CLIENT_ERRORS_KEY);
    for (let i = 0; i < 7; i++) recordClientError(new Error(`boom ${i}`), "smartboard-board");
    const list = readClientErrors();
    expect(list).toHaveLength(5);
    expect(list.map((r) => r.message).join(" ")).toContain("boom 6");
    expect(list[0]!.where).toBe("smartboard-board");
  });
});
