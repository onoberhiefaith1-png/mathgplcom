import { describe, expect, it } from "vitest";
import {
  adminActionForStatus,
  canMintWorkspaceToken,
  shouldExitWhenGrantRevoked,
  supportAccessStatus,
  supportAccessStatusLabel,
  viewingAsLabel,
} from "@/lib/accounts/supportAccess";

const ids = {
  admin: "admin-1",
  staff: "staff-1",
  other: "staff-2",
};

describe("canMintWorkspaceToken", () => {
  it("lets an admin open their own account", () => {
    expect(
      canMintWorkspaceToken({
        adminUserId: ids.admin,
        targetUserId: ids.admin,
        isOwnTestAccount: false,
        grantAllowed: false,
      }),
    ).toBe(true);
  });

  it("lets an admin open a sandbox test account they created", () => {
    expect(
      canMintWorkspaceToken({
        adminUserId: ids.admin,
        targetUserId: ids.staff,
        isOwnTestAccount: true,
        grantAllowed: false,
      }),
    ).toBe(true);
  });

  it("lets an admin open a staff account only when the grant is on", () => {
    expect(
      canMintWorkspaceToken({
        adminUserId: ids.admin,
        targetUserId: ids.staff,
        isOwnTestAccount: false,
        grantAllowed: true,
      }),
    ).toBe(true);
    expect(
      canMintWorkspaceToken({
        adminUserId: ids.admin,
        targetUserId: ids.staff,
        isOwnTestAccount: false,
        grantAllowed: false,
      }),
    ).toBe(false);
  });

  it("never mints a token from an empty identity", () => {
    expect(
      canMintWorkspaceToken({
        adminUserId: "",
        targetUserId: ids.staff,
        isOwnTestAccount: false,
        grantAllowed: true,
      }),
    ).toBe(false);
  });
});

describe("support access status and admin actions", () => {
  it("treats a pending request as request-sent, not as a grant", () => {
    expect(supportAccessStatus({ grantAllowed: false, pendingRequest: true })).toBe("pending");
    expect(adminActionForStatus("pending")).toBe("pending");
    expect(supportAccessStatusLabel("pending")).toBe("Request sent");
  });

  it("offers Enter when the grant is on, or on the admin's own test account", () => {
    expect(supportAccessStatus({ grantAllowed: true, pendingRequest: true })).toBe("granted");
    expect(adminActionForStatus("granted")).toBe("enter");
    expect(adminActionForStatus("none", { isOwnTestAccount: true })).toBe("enter");
    expect(adminActionForStatus("none", { isOwnAccount: true })).toBe("enter");
    expect(adminActionForStatus("none")).toBe("request");
    expect(supportAccessStatusLabel("granted")).toBe("Access granted");
    expect(supportAccessStatusLabel("none")).toBe("No access");
  });
});

describe("grant revocation", () => {
  it("does not end a visit that was opened as an owned or test account", () => {
    expect(shouldExitWhenGrantRevoked({ via: "owned", grantAllowed: false })).toBe(false);
    expect(shouldExitWhenGrantRevoked({ via: undefined, grantAllowed: false })).toBe(false);
  });

  it("ends a grant-backed visit as soon as the switch is off or the row is gone", () => {
    expect(shouldExitWhenGrantRevoked({ via: "grant", grantAllowed: true })).toBe(false);
    expect(shouldExitWhenGrantRevoked({ via: "grant", grantAllowed: false })).toBe(true);
    expect(shouldExitWhenGrantRevoked({ via: "grant", grantAllowed: null })).toBe(true);
  });
});

describe("viewing-as label", () => {
  it("names the person and adds the email when it is different", () => {
    expect(viewingAsLabel({ name: "Ada Teacher", email: "ada@school.test" })).toBe(
      "Viewing as Ada Teacher (ada@school.test)",
    );
    expect(viewingAsLabel({ name: "ada@school.test", email: "ada@school.test" })).toBe(
      "Viewing as ada@school.test",
    );
    expect(viewingAsLabel({ name: "  ", email: null })).toBe("Viewing as this account");
  });
});
