import { describe, expect, it, vi } from "vitest";
import { ACADEMIA_PACK_SCHEMA } from "../academiaPack";
import { fetchRemoteVersion, packIsStale, syncIfStale, updateFailedMessage, VERSION_URL } from "../packSync";

const saved = (version: string, schema = ACADEMIA_PACK_SCHEMA) => ({ schema, version });
const run = (savedPack: ReturnType<typeof saved> | undefined, remote: string | Error, download = vi.fn(async () => true)) => {
  const remoteFn = vi.fn(async () => { if (remote instanceof Error) throw remote; return { schema: ACADEMIA_PACK_SCHEMA, version: remote }; });
  return { download, remoteFn, result: syncIfStale({ saved: async () => savedPack, remote: remoteFn, download }) };
};

describe("pack version sync", () => {
  it("downloads again when the server version differs from the saved one", async () => {
    const t = run(saved("old"), "new");
    expect(await t.result).toBe("updated");
    expect(t.download).toHaveBeenCalledTimes(1);
  });

  it("does NOT download when the versions are equal", async () => {
    const t = run(saved("same"), "same");
    expect(await t.result).toBe("unchanged");
    expect(t.download).not.toHaveBeenCalled();
  });

  it("re-downloads a saved copy in an older format even when the hash matches", async () => {
    const t = run(saved("same", ACADEMIA_PACK_SCHEMA - 1), "same");
    expect(await t.result).toBe("updated");
    expect(packIsStale({ version: "same" }, { version: "same" })).toBe(true);
  });

  it("leaves a first download to the existing path", async () => {
    const t = run(undefined, "new");
    expect(await t.result).toBe("skipped");
    expect(t.remoteFn).not.toHaveBeenCalled();
    expect(t.download).not.toHaveBeenCalled();
  });

  it("reports a failed download or version check instead of swallowing it, and retries next time", async () => {
    expect(await run(saved("old"), "new", vi.fn(async () => false)).result).toBe("failed");
    expect(await run(saved("old"), new Error("offline")).result).toBe("failed");
    const retry = run(saved("old"), "new");
    expect(await retry.result).toBe("updated");
  });

  it("reads the version from the lightweight route and rejects bad answers", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ schema: 6, version: "abc" })));
    expect(await fetchRemoteVersion(ok as unknown as typeof fetch)).toEqual({ schema: 6, version: "abc" });
    expect(ok).toHaveBeenCalledWith(VERSION_URL, expect.objectContaining({ cache: "no-store" }));
    expect(VERSION_URL).toBe("/api/public/academia-pack?versionOnly=1");
    await expect(fetchRemoteVersion((async () => new Response("no", { status: 500 })) as unknown as typeof fetch)).rejects.toThrow("500");
    await expect(fetchRemoteVersion((async () => new Response("{}")) as unknown as typeof fetch)).rejects.toThrow("no version");
  });

  it("words the failure with the saved date, or says nothing is downloaded", () => {
    expect(updateFailedMessage("2026-10-26T10:00:00.000Z", () => "26 Oct 2026")).toBe("Couldn't update, showing saved copy from 26 Oct 2026");
    expect(updateFailedMessage(null)).toMatch(/Nothing is downloaded yet/);
  });
});
