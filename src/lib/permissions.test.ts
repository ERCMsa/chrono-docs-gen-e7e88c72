import { describe, expect, it } from "vitest";
import { canValidateAsResponsible } from "@/lib/permissions";

describe("canValidateAsResponsible", () => {
  it("autorise toujours un administrateur", () => {
    expect(
      canValidateAsResponsible({ isAdmin: true, role: "ADMIN", workerDepartment: "MAINTENANCE" }),
    ).toBe(true);
  });

  it("conserve la règle historique : rôle = département", () => {
    expect(
      canValidateAsResponsible({ isAdmin: false, role: "MONTAGE", workerDepartment: "MONTAGE" }),
    ).toBe(true);
    expect(
      canValidateAsResponsible({ isAdmin: false, role: "MONTAGE", workerDepartment: "CNC" }),
    ).toBe(false);
  });

  it("autorise un DIRECTEUR sur CNC, MONTAGE et PRODUCTION", () => {
    for (const dept of ["CNC", "MONTAGE", "PRODUCTION"]) {
      expect(
        canValidateAsResponsible({ isAdmin: false, role: "DIRECTEUR", workerDepartment: dept }),
      ).toBe(true);
    }
  });

  it("normalise la casse et les espaces", () => {
    expect(
      canValidateAsResponsible({ isAdmin: false, role: "directeur", workerDepartment: " montage " }),
    ).toBe(true);
  });

  it("refuse un DIRECTEUR hors CNC / MONTAGE / PRODUCTION", () => {
    expect(
      canValidateAsResponsible({ isAdmin: false, role: "DIRECTEUR", workerDepartment: "MAINTENANCE" }),
    ).toBe(false);
    expect(
      canValidateAsResponsible({ isAdmin: false, role: "DIRECTEUR", workerDepartment: null }),
    ).toBe(false);
  });

  it("refuse les autres rôles", () => {
    expect(
      canValidateAsResponsible({ isAdmin: false, role: "RH", workerDepartment: "PRODUCTION" }),
    ).toBe(false);
  });
});
