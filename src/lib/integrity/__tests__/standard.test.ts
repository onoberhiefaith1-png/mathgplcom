/**
 * Integrity of the standard itself.
 *
 * The permanent checklist is only trustworthy if its ids are unique and its
 * dependency graph resolves — permanent approvals and correction history are
 * keyed by requirement id, so a collision would corrupt the record.
 */
import { describe, it, expect } from "vitest";
import { summarise } from "../types";
import { ALL_DOMAINS, ALL_REQUIREMENTS, danglingDependencies, duplicateIds, dependentsOf } from "../standard";

describe("permanent system standard", () => {
  it("has no duplicate requirement ids", () => {
    expect(duplicateIds()).toEqual([]);
  });

  it("has no dangling dependencies", () => {
    expect(danglingDependencies()).toEqual([]);
  });

  it("gives every requirement a source, a restoration source and at least one check", () => {
    for (const r of ALL_REQUIREMENTS) {
      expect(r.source, r.id).toBeTruthy();
      expect(r.restorationSource, r.id).toBeTruthy();
      expect(r.validation.length, r.id).toBeGreaterThan(0);
    }
  });

  it("gives every non-passing requirement a severity", () => {
    for (const r of ALL_REQUIREMENTS) {
      if (r.status !== "PASS") expect(r.severity, r.id).toBeTruthy();
    }
  });

  it("starts with no requirement permanently approved by an agent", () => {
    for (const r of ALL_REQUIREMENTS) {
      expect(r.permanent, r.id).toBe("PENDING");
    }
  });

  it("documents coverage for every domain", () => {
    for (const d of ALL_DOMAINS) {
      expect(d.coverage, d.key).toBeTruthy();
      expect(d.requirements.length, d.key).toBeGreaterThan(0);
    }
  });

  it("summarises counts", () => {
    const { total, counts } = summarise(ALL_DOMAINS);
    expect(total).toBe(ALL_REQUIREMENTS.length);
    expect(counts.PASS + counts.PARTIAL + counts.UNKNOWN + counts.FAIL + counts.MISSING).toBe(total);
  });

  it("resolves dependents for a known requirement", () => {
    expect(dependentsOf("AREA-002")).toContain("AREA-004");
  });
});
