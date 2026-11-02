import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  anonymousIdentity,
  lastWorkedKey,
  personKey,
  readLastWorked,
  writeDisplayName,
  writeLastWorked,
  readDisplayName,
} from "./identity";
import {
  classifyMedia,
  cleanActorName,
  collapsedRow,
  historyLine,
  issueToResume,
  managerCanReopen,
  mediaRejection,
  parseIssueLink,
  participantCanSet,
  quickIssueShareUrl,
} from "./model";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe("issue status", () => {
  it("lets a link holder start or complete an open issue", () => {
    expect(participantCanSet("not_started", "in_progress")).toBe(true);
    expect(participantCanSet("not_started", "completed")).toBe(true);
    expect(participantCanSet("in_progress", "completed")).toBe(true);
    expect(participantCanSet("in_progress", "in_progress")).toBe(true);
  });

  it("refuses to let a link holder leave Completed", () => {
    expect(participantCanSet("completed", "in_progress")).toBe(false);
    expect(participantCanSet("completed", "not_started")).toBe(false);
    expect(managerCanReopen("completed", "in_progress")).toBe(true);
    expect(managerCanReopen("completed", "not_started")).toBe(true);
    expect(managerCanReopen("in_progress", "not_started")).toBe(false);
  });

  it("keeps a collapsed row to the name and status", () => {
    expect(
      collapsedRow({ name: "Printer jam", status: "not_started" }),
    ).toEqual({
      name: "Printer jam",
      status: "not_started",
    });
  });

  it("resumes the remembered issue and does not fall back to the first", () => {
    const ids = ["first", "second", "third"];
    expect(issueToResume(ids, null)).toBeNull();
    expect(issueToResume(ids, "missing")).toBeNull();
    expect(issueToResume(ids, "third")).toBe("third");
    expect(issueToResume(ids, "third")).not.toBe(ids[0]);
  });
});

describe("names, links, and files", () => {
  it("accepts a short name and an http(s) link", () => {
    expect(cleanActorName("  Ada ")).toBe("Ada");
    expect(cleanActorName("")).toBeNull();
    expect(parseIssueLink("https://example.com/photo.png")).toBe(
      "https://example.com/photo.png",
    );
    expect(parseIssueLink("javascript:alert(1)")).toBeNull();
    expect(parseIssueLink("notaurl")).toBeNull();
  });

  it("accepts video, audio, images, and other files inside the size limit", () => {
    expect(classifyMedia("video/mp4", "clip.mp4")).toBe("video");
    expect(classifyMedia("audio/webm", "voice.webm")).toBe("audio");
    expect(classifyMedia("image/png", "screen.png")).toBe("image");
    expect(classifyMedia("application/pdf", "notes.pdf")).toBe("file");
    expect(mediaRejection({ name: "clip.mp4", size: 1024 })).toBeNull();
    expect(mediaRejection({ name: "empty.txt", size: 0 })).toMatch(/empty/);
    expect(mediaRejection({ name: "run.exe", size: 20 })).toMatch(
      /can't be attached/,
    );
    expect(
      mediaRejection({ name: "huge.mp4", size: 51 * 1024 * 1024 }),
    ).toMatch(/50 MB/);
  });

  it("records who moved the issue", () => {
    expect(historyLine("in_progress", "Ada", "in_progress")).toBe(
      "Ada set In Progress",
    );
    expect(historyLine("completed", "Bo", "completed")).toBe(
      "Bo set Completed",
    );
    expect(historyLine("reopened", "Owner", "not_started")).toBe(
      "Owner reopened this to Not Started",
    );
  });

  it("builds one school link that is not a sequential id", () => {
    const token = "a".repeat(64);
    expect(quickIssueShareUrl(token, "https://mathgpl.com")).toBe(
      `https://mathgpl.com/issues/${token}`,
    );
  });
});

describe("who last worked the issue", () => {
  it("keeps an anonymous browser separate from a signed-in user", () => {
    const storage = new MemoryStorage();
    const anon = personKey(null, storage);
    const again = personKey(null, storage);
    expect(again).toBe(anon);
    expect(personKey("user-1", storage)).not.toBe(anon);
    expect(anonymousIdentity(storage)).toBe(anonymousIdentity(storage));
    writeLastWorked("abc", null, storage, "issue-9");
    writeLastWorked("abc", "user-1", storage, "issue-2");
    expect(readLastWorked("abc", null, storage)).toBe("issue-9");
    expect(readLastWorked("abc", "user-1", storage)).toBe("issue-2");
    expect(lastWorkedKey("ABC", null, storage)).toBe(
      lastWorkedKey("abc", null, storage),
    );
  });

  it("remembers the typed name on this browser", () => {
    const storage = new MemoryStorage();
    writeDisplayName(storage, " Ada ");
    expect(readDisplayName(storage)).toBe("Ada");
  });
});

describe("migration boundaries", () => {
  const sql = readFileSync(
    "supabase/migrations/20261102120000_quick_issue_tracker.sql",
    "utf8",
  );
  const anonGrant = sql.slice(
    sql.indexOf("The school link can report"),
    sql.indexOf("GRANT EXECUTE ON FUNCTION public.quick_issue_new_token"),
  );

  it("gives the school link report and status writes, not delete or reopen", () => {
    expect(anonGrant).toContain("TO anon");
    expect(anonGrant).toContain("quick_issue_list");
    expect(anonGrant).toContain("quick_issue_create");
    expect(anonGrant).toContain("quick_issue_set_status");
    expect(anonGrant).toContain("quick_issue_add_link");
    expect(anonGrant).not.toContain("quick_issue_delete");
    expect(anonGrant).not.toContain("quick_issue_reopen");
    expect(anonGrant).not.toContain("quick_issue_ensure");
    expect(anonGrant).not.toContain("quick_issue_regenerate");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.quick_issue_delete(uuid) FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.quick_issue_reopen(uuid, text) FROM PUBLIC, anon, authenticated",
    );
  });

  it("uses one unguessable token per school, three statuses, and a soft delete", () => {
    expect(sql).toContain("encode(gen_random_bytes(32), 'hex')");
    expect(sql).toContain("org_id uuid NOT NULL UNIQUE");
    expect(sql).toContain(
      "CHECK (status IN ('not_started', 'in_progress', 'completed'))",
    );
    expect(sql).toContain("deleted_at timestamptz");
    expect(sql).toContain("CHECK (role IN ('issue', 'completion'))");
    expect(sql.toLowerCase()).not.toContain("proof");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_issues",
    );
    expect(sql).toContain(
      "Only a school owner or manager can reopen a completed issue.",
    );
    expect(sql).toContain(
      "Only the school owner or a manager can delete an issue.",
    );
  });
});
