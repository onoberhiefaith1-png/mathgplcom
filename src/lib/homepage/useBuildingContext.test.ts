import { describe, expect, it } from "vitest";

import { resolveBuildingContext, type BuildingContextInput } from "./useBuildingContext";

const base: BuildingContextInput = {
  role: "teacher",
  isPlatformOwner: false,
  visitingSharedWorkspace: false,
  isPersonal: true,
  subscribes: true,
  freeAccess: false,
  subscription: null,
  community: false,
  ownerPro: { id: "owner-pro" },
  ownerFree: { id: "owner-free" },
};

const ctx = (patch: Partial<BuildingContextInput>) => resolveBuildingContext({ ...base, ...patch });

describe("resolveBuildingContext", () => {
  it("treats a full-access teacher with no subscription as able to choose a building", () => {
    const r = ctx({ freeAccess: true });
    expect(r.configMode).toBe("self");
    expect(r.canCustomize).toBe(true);
    expect(r.adsEnabled).toBe(false);
  });

  it("lets a school choose a building and keeps a parent from choosing one", () => {
    expect(ctx({ role: "school", freeAccess: true }).canCustomize).toBe(true);
    expect(ctx({ role: "parent", freeAccess: true }).canCustomize).toBe(false);
  });

  it("keeps an access-code holder on a free plan able to choose", () => {
    const r = ctx({ freeAccess: true, subscription: { price: 0, planKey: "free" } });
    expect(r.canCustomize).toBe(true);
    expect(r.adsEnabled).toBe(false);
  });

  it("leaves a genuinely unpaid free teacher on the owner's Free building", () => {
    const r = ctx({ subscription: { price: 0, planKey: "free" } });
    expect(r.configMode).toBe("platform-free");
    expect(r.canCustomize).toBe(false);
    expect(r.adsEnabled).toBe(true);
  });

  it("lets a paid teacher choose a building", () => {
    const r = ctx({ subscription: { price: 4500, planKey: "teacher_pro" } });
    expect(r.configMode).toBe("self");
    expect(r.canCustomize).toBe(true);
  });

  it("shows the owner's Pro building to a student and never lets them change it", () => {
    const own = ctx({ role: "student", subscribes: false, freeAccess: true });
    expect(own.canCustomize).toBe(false);
    expect(own.configMode).toBe("self");
    expect(own.adsEnabled).toBe(false);

    const ordinary = ctx({ role: "student", subscribes: false });
    expect(ordinary.canCustomize).toBe(false);
    expect(ordinary.adsEnabled).toBe(false);
  });

  it("lets a linked admin account change the building even when the role is student", () => {
    const r = ctx({ role: "student", subscribes: false, isLinkedAdmin: true });
    expect(r.canCustomize).toBe(true);
    expect(r.canManageAds).toBe(true);
  });

  it("keeps a student read-only inside a school, and shows the school building once one is set", () => {
    const unset = ctx({ role: "student", subscribes: false, freeAccess: true, isPersonal: false, visitingSharedWorkspace: true });
    expect(unset.canCustomize).toBe(false);
    expect(unset.configMode).toBe("self");

    const set = ctx({
      role: "student",
      subscribes: false,
      visitingSharedWorkspace: true,
      workspaceKind: "school",
      workspaceOwnerIsPro: true,
      workspaceBuilding: { id: "school" },
    });
    expect(set.configMode).toBe("school-readonly");
    expect(set.canCustomize).toBe(false);
    expect(set.adsEnabled).toBe(false);
  });

  it("keeps a visited workspace read-only", () => {
    const r = ctx({ freeAccess: true, visitingSharedWorkspace: true });
    expect(r.canCustomize).toBe(false);
  });

  it("always shows the Free building in Community", () => {
    const r = ctx({ freeAccess: true, community: true });
    expect(r.configMode).toBe("platform-free");
    expect(r.adsEnabled).toBe(true);
    expect(r.canCustomize).toBe(false);
  });

  it("honours the platform owner preview of each selection", () => {
    expect(ctx({ isPlatformOwner: true, previewVersion: "free" }).adsEnabled).toBe(true);
    expect(ctx({ isPlatformOwner: true, previewVersion: "free" }).configMode).toBe("platform-free");
    expect(ctx({ isPlatformOwner: true, previewVersion: "pro" }).configMode).toBe("self");
    expect(ctx({ isPlatformOwner: true, previewVersion: "pro" }).canCustomize).toBe(true);
  });
});
