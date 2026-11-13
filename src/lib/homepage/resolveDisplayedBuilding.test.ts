import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  resolveDisplayedBuilding,
  viewerBuildingTier,
  type BuildingRef,
  type DisplayedBuildingInput,
  type WorkspaceBuildingInput,
} from "./resolveDisplayedBuilding";

const proBuilding: BuildingRef = { id: "owner-pro", config: { slotOverrides: { "ring-0": { path: "new" } } } };
const freeBuilding: BuildingRef = { id: "owner-free", config: { slotOverrides: { "ring-0": { path: "free-face" } } } };
const older: BuildingRef = { id: "owner-older" };
const schoolBuilding: BuildingRef = { id: "school-building" };
const teacherBuilding: BuildingRef = { id: "teacher-building" };

const base = (patch: Partial<DisplayedBuildingInput> = {}): DisplayedBuildingInput => ({
  role: "teacher",
  isAdmin: false,
  viewerTier: "pro",
  workspace: {
    kind: "teacher",
    ownsWorkspace: true,
    ownerIsPro: true,
    selection: null,
  },
  ownerPro: proBuilding,
  ownerFree: freeBuilding,
  ...patch,
});

const workspace = (patch: Partial<WorkspaceBuildingInput>): WorkspaceBuildingInput => ({
  kind: "teacher",
  ownsWorkspace: true,
  ownerIsPro: true,
  selection: null,
  ...patch,
});

describe("viewerBuildingTier", () => {
  it("treats schools as pro even on a free-looking plan", () => {
    expect(
      viewerBuildingTier({
        role: "school",
        isAdmin: false,
        fullAccess: false,
        subscription: { price: 0, planKey: "free" },
      }),
    ).toBe("pro");
  });

  it("treats every student as pro", () => {
    expect(
      viewerBuildingTier({ role: "student", isAdmin: false, fullAccess: false, subscription: null }),
    ).toBe("pro");
  });

  it("treats a free teacher as free and a paid teacher as pro", () => {
    expect(
      viewerBuildingTier({
        role: "teacher",
        isAdmin: false,
        fullAccess: false,
        subscription: { price: 0, planKey: "teacher_free" },
      }),
    ).toBe("free");
    expect(
      viewerBuildingTier({
        role: "teacher",
        isAdmin: false,
        fullAccess: false,
        subscription: { price: 4500, planKey: "teacher_pro" },
      }),
    ).toBe("pro");
  });

  it("treats full access and admins as pro", () => {
    expect(
      viewerBuildingTier({
        role: "teacher",
        isAdmin: false,
        fullAccess: true,
        subscription: { price: 0, planKey: "free" },
      }),
    ).toBe("pro");
    expect(
      viewerBuildingTier({ role: "student", isAdmin: true, fullAccess: false, subscription: null }),
    ).toBe("pro");
  });

  it("treats a parent on a free plan as free and a paying parent as pro", () => {
    expect(
      viewerBuildingTier({ role: "parent", isAdmin: false, fullAccess: false, subscription: null }),
    ).toBe("free");
    expect(
      viewerBuildingTier({
        role: "parent",
        isAdmin: false,
        fullAccess: false,
        subscription: { price: 1200, planKey: "parent_plus" },
      }),
    ).toBe("pro");
  });
});

describe("resolveDisplayedBuilding", () => {
  it("shows the owner's Pro building to a pro teacher until they choose their own", () => {
    const r = resolveDisplayedBuilding(base());
    expect(r.building?.id).toBe("owner-pro");
    expect(r.source).toBe("owner-pro");
    expect(r.canChange).toBe(true);
    expect(r.canEdit).toBe(false);
    expect(r.adsEnabled).toBe(false);
  });

  it("shows a pro teacher's own building after they choose one", () => {
    const r = resolveDisplayedBuilding(
      base({ workspace: workspace({ selection: teacherBuilding }) }),
    );
    expect(r.building?.id).toBe("teacher-building");
    expect(r.source).toBe("workspace");
    expect(r.canChange).toBe(true);
    expect(r.canEdit).toBe(true);
    expect(r.adsEnabled).toBe(false);
  });

  it("follows a later owner selection immediately, including back to an older building", () => {
    const first = resolveDisplayedBuilding(base());
    const next = resolveDisplayedBuilding(base({ ownerPro: older }));
    const back = resolveDisplayedBuilding(base({ ownerPro: proBuilding }));
    expect(first.building?.id).toBe("owner-pro");
    expect(next.building?.id).toBe("owner-older");
    expect(back.building?.id).toBe("owner-pro");
  });

  it("shows the owner's Free building to a free teacher and refuses changes", () => {
    const r = resolveDisplayedBuilding(
      base({
        viewerTier: "free",
        workspace: workspace({ ownerIsPro: false, selection: teacherBuilding }),
      }),
    );
    expect(r.building?.id).toBe("owner-free");
    expect(r.source).toBe("owner-free");
    expect(r.tier).toBe("free");
    expect(r.adsEnabled).toBe(true);
    expect(r.canChange).toBe(false);
    expect(r.canEdit).toBe(false);
  });

  it("does not let a stale free copy win once the owner points Free at another building", () => {
    const r = resolveDisplayedBuilding(
      base({ viewerTier: "free", ownerFree: older, workspace: workspace({ ownerIsPro: false }) }),
    );
    expect(r.building?.id).toBe("owner-older");
  });

  it("falls free viewers back to the current Pro building when Free is unset", () => {
    const r = resolveDisplayedBuilding(
      base({ viewerTier: "free", ownerFree: null, workspace: workspace({ ownerIsPro: false }) }),
    );
    expect(r.building?.id).toBe("owner-pro");
    expect(r.slotVersion).toBe("pro");
    expect(r.explicit).toBe(false);
    expect(r.adsEnabled).toBe(true);
    expect(r.canEdit).toBe(false);
  });

  it("shows every student the owner's Pro building on their own workspace", () => {
    const r = resolveDisplayedBuilding(
      base({
        role: "student",
        viewerTier: "pro",
        workspace: workspace({ kind: "student", ownerIsPro: false, ownsWorkspace: true }),
      }),
    );
    expect(r.building?.id).toBe("owner-pro");
    expect(r.canChange).toBe(false);
    expect(r.canEdit).toBe(false);
  });

  it("shows a school's chosen building to a student or teacher inside that school", () => {
    for (const role of ["student", "teacher"]) {
      const r = resolveDisplayedBuilding(
        base({
          role,
          viewerTier: role === "student" ? "pro" : "pro",
          workspace: workspace({
            kind: "school",
            ownsWorkspace: false,
            ownerIsPro: true,
            selection: schoolBuilding,
          }),
        }),
      );
      expect(r.building?.id).toBe("school-building");
      expect(r.source).toBe("workspace");
      expect(r.canChange).toBe(false);
      expect(r.adsEnabled).toBe(false);
    }
  });

  it("falls back to the viewer's tier when the school has not chosen a building", () => {
    const student = resolveDisplayedBuilding(
      base({
        role: "student",
        workspace: workspace({ kind: "school", ownsWorkspace: false, ownerIsPro: true, selection: null }),
      }),
    );
    const freeTeacher = resolveDisplayedBuilding(
      base({
        role: "teacher",
        viewerTier: "free",
        workspace: workspace({ kind: "school", ownsWorkspace: false, ownerIsPro: true, selection: null }),
      }),
    );
    expect(student.building?.id).toBe("owner-pro");
    expect(freeTeacher.building?.id).toBe("owner-free");
    expect(freeTeacher.adsEnabled).toBe(true);
    expect(freeTeacher.canChange).toBe(false);
  });

  it("shows a pro teacher's building when a student enters that teacher's workspace", () => {
    const r = resolveDisplayedBuilding(
      base({
        role: "student",
        workspace: workspace({
          kind: "teacher",
          ownsWorkspace: false,
          ownerIsPro: true,
          selection: teacherBuilding,
        }),
      }),
    );
    expect(r.building?.id).toBe("teacher-building");
    expect(r.canChange).toBe(false);
  });

  it("ignores a free teacher's building and shows the owner's Pro building to the student", () => {
    const r = resolveDisplayedBuilding(
      base({
        role: "student",
        workspace: workspace({
          kind: "teacher",
          ownsWorkspace: false,
          ownerIsPro: false,
          selection: teacherBuilding,
        }),
      }),
    );
    expect(r.building?.id).toBe("owner-pro");
  });

  it("lets a pro school choose, and shows that building once it is set", () => {
    const before = resolveDisplayedBuilding(
      base({
        role: "school",
        workspace: workspace({ kind: "school", selection: null }),
      }),
    );
    const after = resolveDisplayedBuilding(
      base({
        role: "school",
        workspace: workspace({ kind: "school", selection: schoolBuilding }),
      }),
    );
    expect(before.building?.id).toBe("owner-pro");
    expect(before.canChange).toBe(true);
    expect(before.canEdit).toBe(false);
    expect(after.building?.id).toBe("school-building");
    expect(after.canEdit).toBe(true);
  });

  it("lets a pro school choose even when the viewer tier input would look free", () => {
    const r = resolveDisplayedBuilding(
      base({
        role: "school",
        viewerTier: "pro",
        workspace: workspace({ kind: "school", ownsWorkspace: true, ownerIsPro: true, selection: null }),
      }),
    );
    expect(r.canChange).toBe(true);
  });

  it("does not let a pro teacher change the building while they are inside a school", () => {
    const r = resolveDisplayedBuilding(
      base({
        workspace: workspace({
          kind: "school",
          ownsWorkspace: false,
          ownerIsPro: true,
          selection: null,
        }),
      }),
    );
    expect(r.building?.id).toBe("owner-pro");
    expect(r.canChange).toBe(false);
  });

  it("does not let parents change a building", () => {
    const pro = resolveDisplayedBuilding(
      base({
        role: "parent",
        viewerTier: "pro",
        workspace: workspace({ kind: "parent", ownerIsPro: false }),
      }),
    );
    const free = resolveDisplayedBuilding(
      base({
        role: "parent",
        viewerTier: "free",
        workspace: workspace({ kind: "parent", ownerIsPro: false }),
      }),
    );
    expect(pro.building?.id).toBe("owner-pro");
    expect(pro.canChange).toBe(false);
    expect(free.building?.id).toBe("owner-free");
    expect(free.canChange).toBe(false);
  });

  it("lets the admin switch the Pro and Free selections independently", () => {
    const pro = resolveDisplayedBuilding(
      base({ role: "platform_owner", isAdmin: true, adminPreview: "pro" }),
    );
    const free = resolveDisplayedBuilding(
      base({ role: "platform_owner", isAdmin: true, adminPreview: "free", ownerFree: older }),
    );
    expect(pro.building?.id).toBe("owner-pro");
    expect(pro.canChange).toBe(true);
    expect(pro.canEdit).toBe(true);
    expect(pro.adsEnabled).toBe(false);
    expect(free.building?.id).toBe("owner-older");
    expect(free.adsEnabled).toBe(true);
    expect(free.canEdit).toBe(true);
  });

  it("does not let an admin preview replace another workspace for everyone else", () => {
    const visitor = resolveDisplayedBuilding(
      base({
        role: "student",
        adminPreview: "free",
        workspace: workspace({
          kind: "school",
          ownsWorkspace: false,
          selection: schoolBuilding,
        }),
      }),
    );
    expect(visitor.building?.id).toBe("school-building");
  });

  it("treats a linked admin account as an admin even when its role is student", () => {
    const r = resolveDisplayedBuilding(
      base({
        role: "student",
        isAdmin: true,
        workspace: workspace({ kind: "student", ownerIsPro: false, ownsWorkspace: true }),
      }),
    );
    expect(r.canChange).toBe(true);
    expect(r.building?.id).toBe("owner-pro");
    expect(r.canEdit).toBe(true);
  });

  it("shows the public Free building to signed-out visitors and Community, read-only", () => {
    const r = resolveDisplayedBuilding(base({ role: null, publicFree: true, viewerTier: "pro" }));
    expect(r.building?.id).toBe("owner-free");
    expect(r.adsEnabled).toBe(true);
    expect(r.canChange).toBe(false);
    expect(r.canEdit).toBe(false);
  });

  it("keeps a chosen school building ahead of the viewer's free tier", () => {
    const r = resolveDisplayedBuilding(
      base({
        role: "teacher",
        viewerTier: "free",
        workspace: workspace({
          kind: "school",
          ownsWorkspace: false,
          ownerIsPro: true,
          selection: schoolBuilding,
        }),
      }),
    );
    expect(r.source).toBe("workspace");
    expect(r.building?.id).toBe("school-building");
    expect(r.adsEnabled).toBe(false);
  });
});

describe("building selection migration", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20261113120000_building_selection.sql", import.meta.url),
    "utf8",
  );

  it("stores two owner selections and a workspace selection, readable by everyone", () => {
    expect(sql).toContain("platform_building_selection");
    expect(sql).toContain("pro_building_id");
    expect(sql).toContain("free_building_id");
    expect(sql).toContain("workspace_building_selection");
    expect(sql).toContain("GRANT SELECT ON public.platform_building_selection TO anon, authenticated");
    expect(sql).toContain("GRANT SELECT ON public.workspace_building_selection TO anon, authenticated");
  });

  it("treats linked admin accounts as admin and refuses students and free accounts", () => {
    expect(sql).toContain("is_flow_admin");
    expect(sql).toContain("platform_test_accounts");
    expect(sql).toContain("Students cannot change the building");
    expect(sql).toContain("A free account cannot change the building");
    expect(sql).toContain("v_kind = 'school'");
  });

  it("lets every viewer read the resolved face, including its artwork files", () => {
    expect(sql).toContain("get_resolved_building");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_resolved_building(uuid, text, uuid) TO anon, authenticated");
    expect(sql).toContain("resolved_building_references_asset");
  });
});
