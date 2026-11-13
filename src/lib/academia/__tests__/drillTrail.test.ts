import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DRILL_TRAIL_PENDING_MS,
  EMPTY_DRILL_TRAIL,
  chooseStoredTrail,
  drillTrailHref,
  drillTrailStorageKey,
  normalizeDrillTrail,
  parseDrillEnvelope,
  readDrillEnvelope,
  readStoredDrillTrail,
  restoreDrillTrail,
  sameDrillTrail,
  searchParamsEqual,
  selectDrillLevel,
  trailFromSearchParams,
  trailToSearchParams,
  trailVisibleInAcademia,
  writeDrillEnvelope,
  type DrillCatalog,
  type DrillTrail,
} from "../drillTrail";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const academia = id(1);
const klass = id(2);
const subject = id(3);
const topic = id(4);
const subtopic = id(5);
const session = id(6);
const other = id(7);

const full: DrillTrail = {
  academiaId: academia,
  classId: klass,
  subjectId: subject,
  topicId: topic,
  subtopicId: subtopic,
  sessionId: session,
};

const catalog: DrillCatalog = {
  classes: [{ id: klass, academia_id: academia }],
  subjects: [{ id: subject, class_id: klass }],
  topics: [{ id: topic, subject_id: subject }],
  subtopics: [{ id: subtopic, topic_id: topic }],
  sessions: [{ id: session, subtopic_id: subtopic }],
};

function memory(): Storage {
  const rows = new Map<string, string>();
  return {
    get length() {
      return rows.size;
    },
    clear: () => rows.clear(),
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => {
      rows.set(key, value);
    },
    removeItem: (key) => {
      rows.delete(key);
    },
    key: (index) => [...rows.keys()][index] ?? null,
  };
}

describe("changing a level clears only what is below it", () => {
  it("keeps the class and clears subject, topic, subtopic and session", () => {
    const next = selectDrillLevel(full, "classId", other);
    expect(next).toEqual({
      ...full,
      classId: other,
      subjectId: null,
      topicId: null,
      subtopicId: null,
      sessionId: null,
    });
    expect(full.subjectId).toBe(subject);
  });

  it("keeps class and subject when the topic changes", () => {
    expect(selectDrillLevel(full, "topicId", other)).toEqual({
      ...full,
      topicId: other,
      subtopicId: null,
      sessionId: null,
    });
  });

  it("selecting a session leaves the rest of the trail", () => {
    expect(selectDrillLevel(full, "sessionId", other).classId).toBe(klass);
    expect(selectDrillLevel(full, "sessionId", other).subtopicId).toBe(
      subtopic,
    );
    expect(selectDrillLevel(full, "sessionId", other).sessionId).toBe(other);
  });

  it("changing academia clears every lower level", () => {
    expect(selectDrillLevel(full, "academiaId", other)).toEqual({
      ...EMPTY_DRILL_TRAIL,
      academiaId: other,
    });
  });

  it("rejects an id that is not a uuid", () => {
    expect(selectDrillLevel(full, "classId", "not-an-id").classId).toBeNull();
    expect(selectDrillLevel(full, "classId", "not-an-id").subjectId).toBeNull();
  });
});

describe("restore falls back to the deepest level that still exists", () => {
  it("restores the whole trail when every level is still visible", () => {
    expect(restoreDrillTrail(full, catalog)).toEqual(full);
  });

  it("drops a missing session and keeps the subtopic", () => {
    expect(restoreDrillTrail(full, { ...catalog, sessions: [] })).toEqual({
      ...full,
      sessionId: null,
    });
  });

  it("keeps the session id until the session list has loaded", () => {
    const { sessions: _sessions, ...waiting } = catalog;
    expect(restoreDrillTrail(full, waiting).sessionId).toBe(session);
  });

  it("drops the subject and everything under it when the teacher lost that subject", () => {
    expect(restoreDrillTrail(full, { ...catalog, subjects: [] })).toEqual({
      ...EMPTY_DRILL_TRAIL,
      academiaId: academia,
      classId: klass,
    });
  });

  it("drops a topic that belongs to a different subject", () => {
    expect(
      restoreDrillTrail(full, {
        ...catalog,
        topics: [{ id: topic, subject_id: other }],
      }),
    ).toEqual({
      ...EMPTY_DRILL_TRAIL,
      academiaId: academia,
      classId: klass,
      subjectId: subject,
    });
  });

  it("drops a subtopic that belongs to a different topic, and the session with it", () => {
    expect(
      restoreDrillTrail(full, {
        ...catalog,
        subtopics: [{ id: subtopic, topic_id: other }],
      }),
    ).toEqual({
      ...EMPTY_DRILL_TRAIL,
      academiaId: academia,
      classId: klass,
      subjectId: subject,
      topicId: topic,
    });
  });

  it("drops a class the catalog no longer contains", () => {
    expect(restoreDrillTrail(full, { ...catalog, classes: [] })).toEqual({
      ...EMPTY_DRILL_TRAIL,
      academiaId: academia,
    });
  });

  it("drops a class that belongs to a different academia", () => {
    expect(
      restoreDrillTrail(full, {
        ...catalog,
        classes: [{ id: klass, academia_id: other }],
      }),
    ).toEqual({ ...EMPTY_DRILL_TRAIL, academiaId: academia });
  });

  it("fills academia from the class when the saved trail has none", () => {
    const restored = restoreDrillTrail({ ...full, academiaId: null }, catalog);
    expect(restored.academiaId).toBe(academia);
    expect(restored.sessionId).toBe(session);
  });

  it("ignores junk and partial json", () => {
    expect(
      restoreDrillTrail(
        normalizeDrillTrail({ classId: "nope", subjectId: subject }),
        catalog,
      ),
    ).toEqual(EMPTY_DRILL_TRAIL);
    expect(parseDrillEnvelope("{")).toBeNull();
    expect(
      parseDrillEnvelope(JSON.stringify({ classId: klass }))?.trail.classId,
    ).toBe(klass);
  });
});

describe("a trail for another academia is not written back", () => {
  it("displays empty and is not owned", () => {
    const view = trailVisibleInAcademia(full, other, catalog.classes);
    expect(view.owned).toBe(false);
    expect(view.trail).toEqual({ ...EMPTY_DRILL_TRAIL, academiaId: other });
    expect(full.classId).toBe(klass);
  });

  it("does not claim a class that this academia does not contain", () => {
    const view = trailVisibleInAcademia(
      { ...full, academiaId: null },
      other,
      catalog.classes,
    );
    expect(view.owned).toBe(false);
  });

  it("owns a trail for this academia", () => {
    expect(trailVisibleInAcademia(full, academia, catalog.classes).owned).toBe(
      true,
    );
  });
});

describe("server value wins on a fresh load", () => {
  const server = { trail: full, updatedAt: "2026-11-13T12:00:00.000Z" };
  const local = {
    trail: { ...full, sessionId: other },
    updatedAt: "2026-11-13T11:00:00.000Z",
    pending: false,
    pendingAt: null,
  };

  it("paints the device copy until the server has answered", () => {
    expect(chooseStoredTrail(local, server, false).sessionId).toBe(other);
  });

  it("uses the server row once it is known", () => {
    expect(chooseStoredTrail(local, server, true)).toEqual(full);
  });

  it("keeps the device copy when the account has no row yet", () => {
    expect(chooseStoredTrail(local, null, true).sessionId).toBe(other);
  });

  it("keeps a save the server has not acknowledged yet", () => {
    const pending = { ...local, pending: true, pendingAt: Date.now() };
    expect(chooseStoredTrail(pending, server, true).sessionId).toBe(other);
  });

  it("stops protecting a pending save after the grace period", () => {
    const stale = {
      ...local,
      pending: true,
      pendingAt: Date.now() - DRILL_TRAIL_PENDING_MS - 1,
    };
    expect(chooseStoredTrail(stale, server, true)).toEqual(full);
  });

  it("keeps a device acknowledgement that is newer than the fetched row", () => {
    const newer = { ...local, updatedAt: "2026-11-13T12:00:02+00:00" };
    expect(chooseStoredTrail(newer, server, true).sessionId).toBe(other);
  });
});

describe("device storage is per account", () => {
  it("does not let one user read another's trail", () => {
    const store = memory();
    writeDrillEnvelope(
      "user-a",
      { trail: full, updatedAt: null, pending: false, pendingAt: null },
      store,
    );
    writeDrillEnvelope(
      "user-b",
      {
        trail: { ...EMPTY_DRILL_TRAIL, classId: other },
        updatedAt: null,
        pending: false,
        pendingAt: null,
      },
      store,
    );
    expect(readStoredDrillTrail("user-a", store)).toEqual(full);
    expect(readStoredDrillTrail("user-b", store).classId).toBe(other);
    expect(drillTrailStorageKey("user-a")).not.toBe(
      drillTrailStorageKey("user-b"),
    );
    expect(readDrillEnvelope("user-a", store)?.trail.sessionId).toBe(session);
  });
});

describe("url trail", () => {
  it("round-trips and drops cleared levels without touching other params", () => {
    const base = new URLSearchParams("tier=expert");
    const params = trailToSearchParams(full, base);
    expect(trailFromSearchParams(params)).toEqual(full);
    expect(params.get("tier")).toBe("expert");
    const cleared = trailToSearchParams(
      selectDrillLevel(full, "subjectId", other),
      params,
    );
    expect(cleared.get("subject")).toBe(other);
    expect(cleared.get("topic")).toBeNull();
    expect(cleared.get("session")).toBeNull();
    expect(drillTrailHref("/academia", full)).toContain("class=");
    expect(
      searchParamsEqual(
        params,
        trailToSearchParams(full, new URLSearchParams("tier=expert")),
      ),
    ).toBe(true);
  });

  it("ignores a tampered query id", () => {
    expect(
      trailFromSearchParams(new URLSearchParams("class=../secret&session=1"))
        .classId,
    ).toBeNull();
    expect(
      sameDrillTrail(
        trailFromSearchParams(new URLSearchParams()),
        EMPTY_DRILL_TRAIL,
      ),
    ).toBe(true);
  });
});

describe("drill trail migration", () => {
  const supabaseSql = readFileSync(
    "supabase/migrations/20261113143000_academia_drill_trail.sql",
    "utf8",
  );
  const drizzleSql = readFileSync(
    "drizzle/migrations/0029_academia_drill_trail.sql",
    "utf8",
  );

  it("lets a user read and write only their own row", () => {
    for (const sql of [supabaseSql, drizzleSql]) {
      expect(sql).toContain("academia_drill_trails");
      expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("user_id = auth.uid()");
      expect(sql).toContain("FOR SELECT");
      expect(sql).toContain("FOR INSERT");
      expect(sql).toContain("FOR UPDATE");
      expect(sql).not.toMatch(/TO anon/);
      expect(sql).toContain(
        "REVOKE ALL ON public.academia_drill_trails FROM PUBLIC, anon",
      );
    }
  });
});
