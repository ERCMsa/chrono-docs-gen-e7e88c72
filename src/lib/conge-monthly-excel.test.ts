import { describe, it, expect, beforeAll } from "vitest";
import { buildMonthlyCongeMatrix } from "@/lib/conge-monthly";
import {
  buildCongeMonthlyWorkbook,
  cellNoteText,
  congeMonthlyFileName,
  type ExcelJSModule,
} from "@/lib/conge-monthly-excel";
import type { Conge, CongeType } from "@/lib/supabase-helpers";
import type { DroitCongeRow } from "@/lib/conge-utils";

const TYPE_LABELS: Record<string, string> = {
  annual: "Congé annuel",
  sick: "Congé maladie",
  unpaid: "Congé sans solde",
};

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
function conge(worker_id: string, start_date: string, end_date: string, conge_type: CongeType = "annual"): Conge {
  seq += 1;
  return {
    id: `c${seq}`,
    worker_id,
    start_date,
    end_date,
    conge_type,
    reason: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const workers = [row("1", "Alice"), row("2", "Bob"), row("3", "Carol")];
const conges = [
  conge("1", "2026-01-28", "2026-02-03"),
  conge("1", "2026-01-05", "2026-01-06", "sick"),
  conge("3", "2026-01-12", "2026-01-13", "unpaid"),
];
const matrix = buildMonthlyCongeMatrix(workers, conges, { from: "2026-01-01", to: "2027-01-01" });

let ExcelJS: ExcelJSModule;
let buffer: ArrayBuffer;

beforeAll(async () => {
  type LoadedModule = ExcelJSModule & { default?: ExcelJSModule };
  const mod = (await import("exceljs")) as LoadedModule;
  ExcelJS = mod.default ?? mod;
  buffer = await buildCongeMonthlyWorkbook(ExcelJS, matrix, {
    periodFrom: "2026-01-01",
    periodTo: "2027-01-01",
    typeLabel: (t) => TYPE_LABELS[t] ?? t,
    generatedAt: new Date(2026, 9, 25),
  });
});

describe("buildCongeMonthlyWorkbook", () => {
  it("écrit la matrice employés × mois avec les bons totaux", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet("Congés par mois");
    expect(ws).toBeTruthy();
    if (!ws) return;

    expect(ws.getCell("A1").value).toBe("CONGÉS — DÉTAIL PAR MOIS PAR EMPLOYÉ");
    expect(ws.getCell("A2").value).toContain("du 01/01/2026 au 31/12/2026");
    expect(ws.getCell("A6").value).toBe("MATRICULE");
    expect(ws.getCell("B6").value).toBe("Employé");
    expect(ws.getCell("C6").value).toBe("Janvier 2026");
    expect(ws.getCell("D6").value).toBe("Février 2026");
    expect(ws.getCell("E6").value).toBe("Congé fait sans weekend (j)");
    expect(ws.getCell("F6").value).toBe("Congé fait (j)");

    // Alice : janvier (28→31 : 2 j ouvrés + 05→06 : 2 j) puis février (1→3 : 3 j,
    // seuls jeudi/vendredi étant exclus)
    expect(ws.getCell("C7").value).toBe(4);
    expect(ws.getCell("D7").value).toBe(3);
    expect(ws.getCell("E7").value).toBe(7);
    expect(ws.getCell("F7").value).toBe(9);

    // Carol : janvier uniquement, février laissé vide (pas de 0)
    expect(ws.getCell("C8").value).toBe(2);
    expect(ws.getCell("D8").value).toBeNull();
    expect(ws.getCell("E8").value).toBe(2);

    // Bob n'a aucun congé : absent du tableau
    expect(ws.getCell("B7").value).toBe("Alice");
    expect(ws.getCell("B8").value).toBe("Carol");

    // Totaux
    expect(ws.getCell("A9").value).toBe("TOTAL");
    expect(ws.getCell("B9").value).toBe("2 employés");
    expect(ws.getCell("C9").value).toBe(6);
    expect(ws.getCell("D9").value).toBe(3);
    expect(ws.getCell("E9").value).toBe(9);
    expect(ws.getCell("F9").value).toBe(11);
  });

  it("met en forme l'en-tête, les volets figés et le filtre", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet("Congés par mois")!;

    expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 6 });
    expect(ws.autoFilter).toBe("A6:F8");
    expect(ws.getCell("A1").isMerged).toBe(true);
    const headerFill = ws.getCell("C6").fill as { fgColor?: { argb?: string } } | undefined;
    expect(headerFill?.fgColor?.argb).toBe("FF1D4ED8");
    expect(ws.getCell("C6").font?.bold).toBe(true);
    expect(ws.getCell("C7").numFmt).toBe("0");
    expect(ws.pageSetup.printTitlesRow).toBe("6:6");
    expect(ws.pageSetup.orientation).toBe("landscape");
  });
});

describe("feuille « Congés par mois avec salaires »", () => {
  async function salarySheet() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return { wb, ws: wb.getWorksheet("Congés par mois avec salaires")! };
  }

  const formulaOf = (ws: { getCell: (ref: string) => { value: unknown } }, ref: string): string =>
    ((ws.getCell(ref).value as { formula?: string } | null)?.formula) ?? "";

  it("ajoute une seconde feuille avec les colonnes de paie au bon endroit", async () => {
    const { wb, ws } = await salarySheet();
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Congés par mois", "Congés par mois avec salaires"]);
    expect(ws).toBeTruthy();

    expect(ws.getCell("A6").value).toBe("MATRICULE");
    expect(ws.getCell("B6").value).toBe("Employé");
    expect(ws.getCell("C6").value).toBe("Droit de congé");
    expect(ws.getCell("D6").value).toBe("Moyen paie");
    expect(ws.getCell("E6").value).toBe("Paie congé");
    expect(ws.getCell("F6").value).toBe("Prime");
    expect(ws.getCell("G6").value).toBe("Paie net");
    expect(ws.getCell("H6").value).toBe("Janvier 2026");
    expect(ws.getCell("I6").value).toBe("Paie");
    expect(ws.getCell("J6").value).toBe("Février 2026");
    expect(ws.getCell("K6").value).toBe("Paie");
    expect(ws.getCell("L6").value).toBe("Congé fait sans weekend (j)");
    expect(ws.getCell("M6").value).toBe("Congé fait (j)");
    expect(ws.getCell("N6").value).toBe("Total paie congé");
    expect(ws.getCell("O6").value).toBe("Cacophat");
    expect(ws.getCell("P6").value).toBe("Finale paie");
  });

  it("reprend la matrice de la première feuille et pré-remplit le droit de congé", async () => {
    const { ws } = await salarySheet();

    // 12 mois travaillés × 1,8333 = 21,9996 → 22,00
    expect(ws.getCell("C7").value).toBe(22);
    expect(ws.getCell("C8").value).toBe(22);
    expect(ws.getCell("H7").value).toBe(4);
    expect(ws.getCell("J7").value).toBe(3);
    expect(ws.getCell("L7").value).toBe(7);
    expect(ws.getCell("M7").value).toBe(9);

    // Colonnes manuelles réellement vides
    for (const ref of ["D7", "F7", "I7", "K7", "O7"]) {
      expect(ws.getCell(ref).value).toBeNull();
    }
  });

  it("écrit des formules Excel pour les colonnes calculées", async () => {
    const { ws } = await salarySheet();

    expect(formulaOf(ws, "E7")).toContain("D7/22");
    expect(formulaOf(ws, "E7")).toContain("C7");
    expect(formulaOf(ws, "G7")).toContain("E7");
    expect(formulaOf(ws, "G7")).toContain("F7");
    // Total paie congé = Σ (jours du mois / 22 × Paie du mois)
    expect(formulaOf(ws, "N7")).toContain("(H7/22)*I7");
    expect(formulaOf(ws, "N7")).toContain("(J7/22)*K7");
    // Finale paie = Paie net − Cacophat − Total paie congé
    expect(formulaOf(ws, "P7")).toContain("G7");
    expect(formulaOf(ws, "P7")).toContain("O7");
    expect(formulaOf(ws, "P7")).toContain("N7");

    expect(ws.getCell("C7").numFmt).toBe("0.00");
    expect(ws.getCell("E7").numFmt).toBe("#,##0.00");
    expect(ws.getCell("H7").numFmt).toBe("0");
    expect(ws.getCell("I7").numFmt).toBe("#,##0.00");
  });

  it("conserve les totaux et le filtre de la première feuille", async () => {
    const { ws } = await salarySheet();

    expect(ws.getCell("A9").value).toBe("TOTAL");
    expect(ws.getCell("B9").value).toBe("2 employés");
    expect(ws.getCell("H9").value).toBe(6);
    expect(ws.getCell("J9").value).toBe(3);
    expect(ws.getCell("L9").value).toBe(9);
    expect(ws.getCell("M9").value).toBe(11);
    expect(formulaOf(ws, "C9")).toBe("SUM(C7:C8)");
    expect(formulaOf(ws, "N9")).toBe("SUM(N7:N8)");
    expect(ws.autoFilter).toBe("A6:P8");
    expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 6 });
  });
});

describe("cellNoteText", () => {
  it("détaille chaque congé du mois avec le nombre de jours du mois", () => {
    const text = cellNoteText([conges[0], conges[1]], "2026-01", (t) => TYPE_LABELS[t] ?? t);
    expect(text).toContain("28/01/2026 → 03/02/2026");
    expect(text).toContain("Congé annuel");
    expect(text).toContain("2 j ce mois (5 j au total)");
    expect(text).toContain("05/01/2026 → 06/01/2026");
    expect(text).toContain("Congé maladie");
    expect(text).toContain("jeudi et vendredi");
  });
});

describe("congeMonthlyFileName", () => {
  it("nomme le fichier avec l'année de la période", () => {
    expect(congeMonthlyFileName("2026-01-01")).toBe("Conges_par_mois_2026.xlsx");
  });
});
