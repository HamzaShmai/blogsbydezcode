import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { isAgencyRole, isAdminRole } from "@/lib/rbac";

describe("rbac helpers", () => {
  it("identifies agency roles", () => {
    expect(isAgencyRole(Role.AGENCY_ADMIN)).toBe(true);
    expect(isAgencyRole(Role.CLIENT_VIEWER)).toBe(false);
  });

  it("identifies admin roles", () => {
    expect(isAdminRole(Role.CLIENT_ADMIN)).toBe(true);
    expect(isAdminRole(Role.AGENCY_MEMBER)).toBe(false);
  });
});
