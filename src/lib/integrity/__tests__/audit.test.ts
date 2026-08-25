/**
 * Guards on the audit machinery itself: totals must always be folded from
 * individual requirements, a segment run must touch only its own requirement
 * ids, and an UNKNOWN requirement must never be promoted to PASS just because
 * structural checks found nothing wrong.
 */
import { describe, it, expect } from "vitest";
import { ALL_DOMAINS, ALL_REQUIREMENTS } from "../standard";
import { auditRequirement, worst } from "../checks";
import { countRequirements, globalCounts, segmentRows, sortForDashboard } from "../segments";
import type { Requirement } from "../types";

const routePaths = new Set<string>(["/", "/admin/integrity"]);

describe("audit dashboard rollups", () => {
  it("folds global totals from the registry when nothing has been audited", () => {
    const totals = globalCounts({});
    expect(totals.total).toBe(ALL_REQUIREMENTS.length);
    expect(totals.PASS + totals.PARTIAL + totals.UNKNOWN + totals.FAIL + totals.MISSING).toBe(totals.total);
  });

  it("recomputes totals from a stored result instead of a hard-coded number", () => {
    const partial = ALL_REQUIREMENTS.find((r) => r.status === "PARTIAL")!;
    const before = globalCounts({});
    const after = globalCounts({ [partial.id]: { status: "PASS" } });
    expect(after.PASS).toBe(before.PASS + 1);
    expect(after.PARTIAL).toBe(before.PARTIAL - 1);
    expect(after.total).toBe(before.total);
  });

  it("gives every segment a row whose counts match its own requirements", () => {
    const rows = segmentRows({});
    expect(rows).toHaveLength(ALL_DOMAINS.length);
    for (const domain of ALL_DOMAINS) {
      const row = rows.find((r) => r.key === domain.key)!;
      expect(row.counts).toEqual(countRequirements(domain.requirements, {}));
    }
  });

  it("lists problem segments before passing ones", () => {
    const sorted = sortForDashboard(segmentRows({}));
    const firstPass = sorted.findIndex((r) => r.status === "PASS");
    if (firstPass > -1) {
      expect(sorted.slice(firstPass).every((r) => r.status === "PASS")).toBe(true);
    }
  });

  it("takes the worst status of a set", () => {
    expect(worst(["PASS", "UNKNOWN", "PARTIAL"])).toBe("PARTIAL");
    expect(worst(["PASS", "PASS"])).toBe("PASS");
    expect(worst(["UNKNOWN", "FAIL"])).toBe("FAIL");
  });
});

describe("requirement auditing", () => {
  const base: Requirement = {
    id: "TEST-001",
    name: "test",
    category: "test",
    source: "test",
    requirement: "test",
    behaviour: ["test"],
    implementation: {},
    validation: [{ kind: "module", target: "src/lib/integrity/types.ts" }],
    restorationSource: "test",
    status: "PASS",
    permanent: "PENDING",
  };

  it("passes when the module exists", async () => {
    const outcome = await auditRequirement(base, { routePaths, tables: {} });
    expect(outcome.status).toBe("PASS");
  });

  it("fails when the module is absent", async () => {
    const outcome = await auditRequirement(
      { ...base, validation: [{ kind: "module", target: "src/lib/integrity/nope.ts" }] },
      { routePaths, tables: {} },
    );
    expect(outcome.status).toBe("FAIL");
  });

  it("never promotes an UNKNOWN requirement to PASS on structural checks alone", async () => {
    const outcome = await auditRequirement(
      { ...base, status: "UNKNOWN", severity: "MEDIUM" },
      { routePaths, tables: {} },
    );
    expect(outcome.status).toBe("UNKNOWN");
    expect(outcome.reason).toBeTruthy();
  });

  it("reports manual checks as unverified rather than passing", async () => {
    const outcome = await auditRequirement(
      { ...base, validation: [{ kind: "manual", target: "look at the board" }] },
      { routePaths, tables: {} },
    );
    expect(outcome.status).toBe("UNKNOWN");
  });
});
