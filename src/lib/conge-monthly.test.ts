import { describe, it, expect } from "vitest";
import { congeDurationExcludingWeekend } from "@/lib/conge-days";
import type { Conge, CongeType } from "@/lib/supabase-helpers";
import { buildMonthlyCongeMatrix, monthLabel, splitCongeAcrossMonths } from "@/lib/conge-monthly";
import type { DroitCongeRow } from "@/lib/conge-utils";

function row(id: string, name: string, matricule = `M-${id}`): DroitCongeRow {
  return {
    id,
    name,
    matricule,
    monthWorked: 12,
    congeFait: 0,
    congeFaitHorsWeekend: 0,
    congeDroit: 30,
    resteConge: 30,
    enterDate: "2020-01-01",
    inPeriod: true,
    resignedAt: null,
  };
}

let seq = 0;
function conge(worker_id: string, start_date: string, end_date: string, conge_type: CongeType = "annual", reason: string | null = null): Conge {
  seq += 1;
  return {
    id: `c${seq}`,
    worker_id,
    start_date,
    end_date,
    conge_type,
    reason,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("splitCongeAcrossMonths", () => {
  it("répartit un congé à cheval sur deux mois", () => {
    const buckets = splitCongeAcrossMonths("2026-01-28", "2026-02-03");
    expect(buckets.map((b) => b.monthKey)).toEqual(["2026-01", "2026-02"]);
    expect(buckets.map((b) => b.days)).toEqual([4, 3]);
    // 28/01 (mercredi) et 31/01 (samedi) sont travaillables ; le 29 et 30 sont
    // jeudi/vendredi (repos). 01/02 dimanche, 02/02 lundi, 03/02 mardi.
    expect(buckets.map((b) => b.workingDays)).toEqual([2, 3]);
  });

  it("retourne 0 jour travaillable sur une plage jeudi + vendredi", () => {
    expect(splitCongeAcrossMonths("2026-01-01", "2026-01-02")).toEqual([
      { monthKey: "2026-01", days: 2, workingDays: 0 },
    ]);
  });

  it("respecte la même règle que congeDurationExcludingWeekend", () => {
    const start = "2026-03-03";
    const end = "2026-04-14";
    const buckets = splitCongeAcrossMonths(start, end);
    const total = buckets.reduce((s, b) => s + b.workingDays, 0);
    expect(total).toBe(congeDurationExcludingWeekend(start, end));
  });

  it("ignore les dates invalides ou inversées", () => {
    expect(splitCongeAcrossMonths("", "")).toEqual([]);
    expect(splitCongeAcrossMonths("2026-02-10", "2026-02-01")).toEqual([]);
  });
});

describe("buildMonthlyCongeMatrix", () => {
  it("affiche uniquement les mois et les employés qui ont un congé", () => {
    const workers = [row("1", "Alice"), row("2", "Bob"), row("3", "Carol")];
    const conges = [
      conge("1", "2026-01-05", "2026-01-09"),
      conge("1", "2026-03-02", "2026-03-06"),
      conge("2", "2026-02-02", "2026-02-06"),
    ];

    const matrix = buildMonthlyCongeMatrix(workers, conges, { from: "2026-01-01", to: "2027-01-01" });

    expect(matrix.months.map((m) => m.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(matrix.months.map((m) => m.label)).toEqual(["Janvier 2026", "Février 2026", "Mars 2026"]);
    // Carol n'a aucun congé : elle n'apparaît pas
    expect(matrix.rows.map((r) => r.name)).toEqual(["Alice", "Bob"]);
    // Aucune cellule pour les mois sans congé
    expect(Object.keys(matrix.rows[0].cells).sort()).toEqual(["2026-01", "2026-03"]);
    expect(Object.keys(matrix.rows[1].cells)).toEqual(["2026-02"]);
  });

  it("agrège plusieurs congés dans le même mois et calcule les totaux", () => {
    const workers = [row("1", "Alice")];
    const conges = [
      conge("1", "2026-01-05", "2026-01-06"),
      conge("1", "2026-01-12", "2026-01-13", "sick"),
    ];

    const matrix = buildMonthlyCongeMatrix(workers, conges, { from: "2026-01-01", to: "2027-01-01" });

    const cell = matrix.rows[0].cells["2026-01"];
    expect(cell.days).toBe(4);
    expect(cell.conges).toHaveLength(2);
    expect(matrix.rows[0].totalDays).toBe(4);
    expect(matrix.totals["2026-01"].days).toBe(4);
    expect(matrix.totalDays).toBe(4);
    expect(matrix.rows[0].totalWorkingDays).toBe(
      congeDurationExcludingWeekend("2026-01-05", "2026-01-06") +
        congeDurationExcludingWeekend("2026-01-12", "2026-01-13"),
    );
  });

  it("applique le même périmètre que le tableau (date de début dans la période)", () => {
    const workers = [row("1", "Alice")];
    const conges = [
      conge("1", "2025-12-30", "2026-01-05"), // commence avant la période : exclu
      conge("1", "2026-12-30", "2027-01-05"), // commence dans la période : inclus
      conge("1", "2027-01-02", "2027-01-04"), // commence après la période : exclu
    ];

    const matrix = buildMonthlyCongeMatrix(workers, conges, { from: "2026-01-01", to: "2027-01-01" });

    expect(Object.keys(matrix.rows[0].cells)).toEqual(["2026-12", "2027-01"]);
    expect(matrix.rows[0].totalDays).toBe(7);
  });

  it("ignore les congés des employés hors du tableau filtré et conserve l'ordre des lignes", () => {
    const workers = [row("2", "Bob"), row("1", "Alice")];
    const conges = [
      conge("1", "2026-01-05", "2026-01-06"),
      conge("2", "2026-01-07", "2026-01-08"),
      conge("9", "2026-01-05", "2026-01-06"), // employé non affiché
    ];

    const matrix = buildMonthlyCongeMatrix(workers, conges, { from: "2026-01-01", to: "2027-01-01" });

    expect(matrix.rows.map((r) => r.name)).toEqual(["Bob", "Alice"]);
    expect(matrix.rows).toHaveLength(2);
  });

  it("retourne une matrice vide sans congé", () => {
    const matrix = buildMonthlyCongeMatrix([row("1", "Alice")], [], { from: "2026-01-01", to: "2027-01-01" });
    expect(matrix.months).toEqual([]);
    expect(matrix.rows).toEqual([]);
    expect(matrix.totalDays).toBe(0);
  });
});

describe("monthLabel", () => {
  it("formate la clé de mois en français", () => {
    expect(monthLabel("2026-01")).toBe("Janvier 2026");
    expect(monthLabel("2026-12")).toBe("Décembre 2026");
  });
});
