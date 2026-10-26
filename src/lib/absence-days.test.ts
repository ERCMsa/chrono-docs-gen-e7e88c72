import { describe, expect, it } from "vitest";
import { expandAbsenceDays, isAbsenceNonWorkingDay } from "@/lib/absence-days";

describe("expandAbsenceDays", () => {
  it("exclut les jeudis et vendredis d'un intervalle", () => {
    // 26/10/2026 = lundi ; 29 = jeudi ; 30 = vendredi ; 02/11 = lundi.
    expect(expandAbsenceDays("2026-10-26", "2026-11-02")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("retourne un tableau vide si l'intervalle ne contient que jeudi/vendredi", () => {
    expect(expandAbsenceDays("2026-10-29", "2026-10-30")).toEqual([]);
  });

  it("conserve une date unique même si elle tombe un jeudi", () => {
    expect(expandAbsenceDays("2026-10-29")).toEqual(["2026-10-29"]);
    expect(expandAbsenceDays("2026-10-29", "2026-10-29")).toEqual(["2026-10-29"]);
  });

  it("retourne un tableau vide pour une date invalide ou une fin antérieure", () => {
    expect(expandAbsenceDays("")).toEqual([]);
    expect(expandAbsenceDays("2026-10-30", "2026-10-26")).toEqual([]);
  });
});

describe("isAbsenceNonWorkingDay", () => {
  it("identifie jeudi et vendredi comme jours non travaillés", () => {
    expect(isAbsenceNonWorkingDay("2026-10-29")).toBe(true); // jeudi
    expect(isAbsenceNonWorkingDay("2026-10-30")).toBe(true); // vendredi
    expect(isAbsenceNonWorkingDay("2026-10-31")).toBe(false); // samedi
    expect(isAbsenceNonWorkingDay("2026-10-26")).toBe(false); // lundi
  });
});
