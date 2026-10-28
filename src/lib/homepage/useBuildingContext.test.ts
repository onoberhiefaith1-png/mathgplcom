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
};

const ctx = (patch: Partial<BuildingContextInput>) => resolveBuildingContext({ ...base, ...patch });

describe("resolveBuildingContext", () => {
  it("treats a full-access teacher with no subscription as paid", () => {
    const r = ctx({ freeAccess: true });
    expect(r.configMode).toBe("self");
    expect(r.canCustomize).toBe(true);
    expect(r.adsEnabled).toBe(false);
  });

  it("treats a full-access parent and school the same way", () => {
    for (const role of ["parent", "school"]) {
      const r = ctx({ role, freeAccess: true });
      expect(r.canCustomize).toBe(true);
      expect(r.configMode).toBe("self");
    }
  });

  it("keeps an access-code holder on a free:active plan editable", () => {
    const r = ctx({ freeAccess: true, subscription: { price: 0, planKey: "free" } });
    expect(r.canCustomize).toBe(true);
    expect(r.adsEnabled).toBe(false);
  });

  it("leaves a genuinely unpaid free teacher on the advert building", () => {
    const r = ctx({ subscription: { price: 0, planKey: "free" } });
    expect(r.configMode).toBe("platform-free");
    expect(r.canCustomize).toBe(false);
    expect(r.adsEnabled).toBe(true);
  });

  it("gives a paid subscriber their own building", () => {
    const r = ctx({ subscription: { price: 4500, planKey: "teacher_pro" } });
    expect(r.configMode).toBe("self");
    expect(r.canCustomize).toBe(true);
  });

  it("lets a full-access student edit their own personal homepage", () => {
    const r = ctx({ role: "student", subscribes: false, freeAccess: true });
    expect(r.configMode).toBe("self");
    expect(r.canCustomize).toBe(true);
  });

  it("keeps an ordinary student read-only", () => {
    const r = ctx({ role: "student", subscribes: false });
    expect(r.canCustomize).toBe(false);
    expect(r.configMode).toBe("school-readonly");
  });

  it("keeps a full-access student read-only inside a school workspace", () => {
    const r = ctx({ role: "student", subscribes: false, freeAccess: true, isPersonal: false });
    expect(r.canCustomize).toBe(false);
    expect(r.configMode).toBe("school-readonly");
  });

  it("keeps a visited workspace read-only for everyone", () => {
    const r = ctx({ freeAccess: true, visitingSharedWorkspace: true });
    expect(r.configMode).toBe("school-readonly");
    expect(r.canCustomize).toBe(false);
  });

  it("always shows the advert building in Community", () => {
    const r = ctx({ freeAccess: true, community: true });
    expect(r.configMode).toBe("platform-free");
    expect(r.adsEnabled).toBe(true);
    expect(r.canCustomize).toBe(false);
  });

  it("honours the platform owner preview override", () => {
    expect(ctx({ isPlatformOwner: true, previewVersion: "free" }).adsEnabled).toBe(true);
    expect(ctx({ isPlatformOwner: true, previewVersion: "pro" }).configMode).toBe("self");
  });
});
