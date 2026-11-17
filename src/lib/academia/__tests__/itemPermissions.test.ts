import { describe, expect, it } from "vitest";
import {
  academiaNameError,
  canManageAcademiaActivity,
  canManageAcademiaItem,
  canReorderAcademiaSession,
  trimmedAcademiaName,
} from "../itemPermissions";

describe("canManageAcademiaItem", () => {
  it("lets the school owner manage every level, including items they did not create", () => {
    for (const kind of ["class", "subject", "topic", "subtopic", "session"] as const) {
      expect(canManageAcademiaItem({ kind, isOrgOwner: true, userId: "owner", createdBy: "teacher" })).toBe(true);
      expect(canManageAcademiaItem({ kind, isOrgOwner: true, userId: "owner", createdBy: null })).toBe(true);
    }
  });
  it("never lets a teacher rename a class or subject", () => {
    expect(canManageAcademiaItem({ kind: "class", isOrgOwner: false, userId: "t", createdBy: "t" })).toBe(false);
    expect(canManageAcademiaItem({ kind: "subject", isOrgOwner: false, userId: "t", createdBy: "t" })).toBe(false);
  });
  it("lets only the creating teacher manage a topic, subtopic or session", () => {
    for (const kind of ["topic", "subtopic", "session"] as const) {
      expect(canManageAcademiaItem({ kind, isOrgOwner: false, userId: "t", createdBy: "t" })).toBe(true);
      expect(canManageAcademiaItem({ kind, isOrgOwner: false, userId: "t", createdBy: "other" })).toBe(false);
      expect(canManageAcademiaItem({ kind, isOrgOwner: false, userId: "t", createdBy: null })).toBe(false);
      expect(canManageAcademiaItem({ kind, isOrgOwner: false, userId: null, createdBy: "t" })).toBe(false);
    }
  });
});

describe("activity and reorder rules", () => {
  it("lets the school owner, the activity creator, or the session creator manage an activity", () => {
    expect(canManageAcademiaActivity({ isOrgOwner: true, userId: "owner", activityCreatedBy: "a", sessionCreatedBy: "s" })).toBe(true);
    expect(canManageAcademiaActivity({ isOrgOwner: false, userId: "a", activityCreatedBy: "a", sessionCreatedBy: "s" })).toBe(true);
    expect(canManageAcademiaActivity({ isOrgOwner: false, userId: "s", activityCreatedBy: "a", sessionCreatedBy: "s" })).toBe(true);
    expect(canManageAcademiaActivity({ isOrgOwner: false, userId: "other", activityCreatedBy: "a", sessionCreatedBy: "s" })).toBe(false);
    expect(canManageAcademiaActivity({ isOrgOwner: false, userId: "other", activityCreatedBy: null, sessionCreatedBy: null })).toBe(false);
  });
  it("lets only the school owner or session creator reorder a batch", () => {
    expect(canReorderAcademiaSession({ isOrgOwner: true, userId: "owner", sessionCreatedBy: "s" })).toBe(true);
    expect(canReorderAcademiaSession({ isOrgOwner: false, userId: "s", sessionCreatedBy: "s" })).toBe(true);
    expect(canReorderAcademiaSession({ isOrgOwner: false, userId: "a", sessionCreatedBy: "s" })).toBe(false);
    expect(canReorderAcademiaSession({ isOrgOwner: false, userId: "s", sessionCreatedBy: null })).toBe(false);
  });
});

describe("academiaNameError", () => {
  it("rejects empty or blank names and trims a valid one", () => {
    expect(academiaNameError("")).toBe("Enter a name.");
    expect(academiaNameError("   ")).toBe("Enter a name.");
    expect(academiaNameError("  Algebra  ")).toBeNull();
    expect(trimmedAcademiaName("  Algebra  ")).toBe("Algebra");
    expect(academiaNameError("x".repeat(201))).toMatch(/too long/);
  });
});
