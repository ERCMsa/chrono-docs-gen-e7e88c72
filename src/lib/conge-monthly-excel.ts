/**
 * Génération du classeur Excel « Congés — détail par mois » (ExcelJS).
 *
 * Module séparé du composant React pour être testable hors navigateur : le
 * composant ne fait que charger ExcelJS à la demande, appeler ce module puis
 * déclencher le téléchargement.
 */

import { congeDurationExcludingWeekend } from "./conge-days";
import { splitCongeAcrossMonths, type MonthlyMatrix } from "./conge-monthly";
import type { Conge } from "./supabase-helpers";

export type ExcelJSModule = typeof import("exceljs");

export type MonthlyWorkbookOptions = {
  /** Premier jour de la période (inclus), "YYYY-MM-DD". */
  periodFrom: string;
  /** Fin de la période (exclue), "YYYY-MM-DD". */
  periodTo: string;
  /** Libellé d'un type de congé (« Congé annuel », …). */
  typeLabel?: (congeType: string) => string;
  /** Date de génération, pour les tests. */
  generatedAt?: Date;
};

const HEADER_ROW = 6;
const FIRST_DATA_ROW = HEADER_ROW + 1;
const TITLE_ROW = 1;
const META_START_ROW = 2;

const COLORS = {
  title: "FF12324F",
  header: "FF1D4ED8",
  headerBorder: "FF12324F",
  border: "FFD7E0EA",
  stripe: "FFF4F8FC",
  totalFill: "FFE3EEFF",
  totalBorder: "FF1D4ED8",
  muted: "FF64748B",
  white: "FFFFFFFF",
};

function fmtDateFR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function todayFR(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

/** Dernier jour inclus de la période (periodTo est exclusif). */
function lastDayOfPeriod(periodTo: string): string {
  const d = new Date(`${periodTo}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function border(color: string, style: "thin" | "medium" = "thin") {
  const side = { style, color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

/** Commentaire de cellule : le détail des congés du mois. */
export function cellNoteText(conges: Conge[], monthKey: string, typeLabel?: (t: string) => string): string {
  const lines = conges.map((c) => {
    const bucket = splitCongeAcrossMonths(c.start_date, c.end_date).find((b) => b.monthKey === monthKey);
    const monthDays = bucket ? bucket.workingDays : 0;
    const totalDays = congeDurationExcludingWeekend(c.start_date, c.end_date);
    const parts = [
      `${fmtDateFR(c.start_date)} → ${fmtDateFR(c.end_date)}`,
      typeLabel ? typeLabel(c.conge_type) : c.conge_type,
      `${monthDays} j ce mois (${totalDays} j au total)`,
    ];
    if (c.reason) parts.push(`Motif : ${c.reason}`);
    return parts.join(" · ");
  });
  lines.push("Règle : jours de repos (jeudi et vendredi) exclus.");
  return lines.join("\n");
}

/** Nom du fichier exporté, ex. `Conges_par_mois_2026.xlsx`. */
export function congeMonthlyFileName(periodFrom: string): string {
  return `Conges_par_mois_${periodFrom.slice(0, 4)}.xlsx`;
}

/**
 * Construit le classeur et retourne le binaire XLSX prêt à télécharger.
 *
 * Une seule feuille : matrice employés × mois. Seuls les mois contenant au
 * moins un congé apparaissent en colonne, seuls les employés ayant au moins un
 * congé apparaissent en ligne, et un mois sans congé laisse une cellule vide.
 */
export async function buildCongeMonthlyWorkbook(
  ExcelJS: ExcelJSModule,
  matrix: MonthlyMatrix,
  opts: MonthlyWorkbookOptions,
): Promise<ArrayBuffer> {
  const { periodFrom, periodTo, typeLabel } = opts;
  const generatedAt = opts.generatedAt ?? new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Chrono Docs";
  workbook.created = generatedAt;
  workbook.title = "Congés par mois";

  const lastCol = 2 + matrix.months.length + 2;
  const totalCol = 2 + matrix.months.length + 1; // Total sans weekend
  const daysCol = totalCol + 1; // Congé fait

  const ws = workbook.addWorksheet("Congés par mois", {
    views: [{ state: "frozen", xSplit: 2, ySplit: HEADER_ROW }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      paperSize: 9, // A4
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
      margins: { left: 0.4, right: 0.4, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3 },
    },
  });
  ws.headerFooter.oddFooter = "&LCongés par mois&CPage &P / &N&R&D";

  // ===== Bloc titre + métadonnées =====
  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, lastCol);
  const title = ws.getCell(TITLE_ROW, 1);
  title.value = "CONGÉS — DÉTAIL PAR MOIS PAR EMPLOYÉ";
  title.font = { bold: true, size: 16, color: { argb: COLORS.white } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.title } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(TITLE_ROW).height = 36;

  const metaLines = [
    `Période : du ${fmtDateFR(periodFrom)} au ${fmtDateFR(lastDayOfPeriod(periodTo))}`,
    "Jours de repos exclus : jeudi et vendredi",
    `Généré le : ${todayFR(generatedAt)} — cellule vide = aucun congé ce mois`,
  ];
  metaLines.forEach((line, i) => {
    const rowIdx = META_START_ROW + i;
    ws.mergeCells(rowIdx, 1, rowIdx, lastCol);
    const cell = ws.getCell(rowIdx, 1);
    cell.value = line;
    cell.font = { italic: true, size: 10, color: { argb: COLORS.muted } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });
  ws.getRow(HEADER_ROW - 1).height = 8;

  // ===== En-têtes =====
  const headers = [
    "MATRICULE",
    "Employé",
    ...matrix.months.map((m) => m.label),
    "Congé fait sans weekend (j)",
    "Congé fait (j)",
  ];
  const headerRow = ws.getRow(HEADER_ROW);
  headers.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.header } };
    cell.alignment = {
      vertical: "middle",
      horizontal: i < 2 ? "left" : "center",
      wrapText: true,
      indent: i < 2 ? 1 : 0,
    };
    cell.border = border(COLORS.headerBorder, "thin");
  });
  headerRow.height = 40;

  // ===== Lignes employés =====
  matrix.rows.forEach((row, index) => {
    const rowIdx = FIRST_DATA_ROW + index;
    const excelRow = ws.getRow(rowIdx);
    const striped = index % 2 === 1;
    const values: Array<string | number | null> = [
      row.matricule,
      row.name,
      ...matrix.months.map((m) => {
        const cell = row.cells[m.key];
        // Mois sans congé : cellule réellement vide (pas de 0 trompeur)
        return cell ? cell.workingDays : null;
      }),
      row.totalWorkingDays,
      row.totalDays,
    ];

    values.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      if (value !== null && value !== undefined) cell.value = value;
      cell.border = border(COLORS.border);
      if (striped) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.stripe } };
      }
      cell.alignment = {
        vertical: "middle",
        horizontal: i < 2 ? "left" : "center",
        indent: i < 2 ? 1 : 0,
      };
      if (i >= 2) cell.numFmt = "0";
      if (i >= 2 + matrix.months.length) cell.font = { bold: true };

      // Commentaire détaillé sur les cellules de mois concernées
      if (i >= 2 && i < 2 + matrix.months.length) {
        const month = matrix.months[i - 2];
        const monthCell = row.cells[month.key];
        if (monthCell && monthCell.conges.length > 0) {
          cell.note = {
            texts: [{ text: cellNoteText(monthCell.conges, month.key, typeLabel) }],
            margins: { insetmode: "custom", inset: [0.15, 0.15, 0.15, 0.15] },
          };
        }
      }
    });
    excelRow.height = 20;
  });

  const lastDataRow = FIRST_DATA_ROW + matrix.rows.length - 1;

  // ===== Ligne de totaux =====
  const totalRowIdx = lastDataRow + 1;
  const totalRow = ws.getRow(totalRowIdx);
  const totalValues: Array<string | number> = [
    "TOTAL",
    `${matrix.rows.length} employé${matrix.rows.length > 1 ? "s" : ""}`,
    ...matrix.months.map((m) => matrix.totals[m.key]?.workingDays ?? 0),
    matrix.totalWorkingDays,
    matrix.totalDays,
  ];
  totalValues.forEach((value, i) => {
    const cell = totalRow.getCell(i + 1);
    cell.value = value;
    cell.font = { bold: true, size: 11, color: { argb: COLORS.title } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalFill } };
    cell.border = border(COLORS.totalBorder, "medium");
    cell.alignment = {
      vertical: "middle",
      horizontal: i < 2 ? "left" : "center",
      indent: i < 2 ? 1 : 0,
    };
    if (i >= 2) cell.numFmt = "0";
  });
  totalRow.height = 22;

  // ===== Légende =====
  const legendRowIdx = totalRowIdx + 2;
  ws.mergeCells(legendRowIdx, 1, legendRowIdx, lastCol);
  const legend = ws.getCell(legendRowIdx, 1);
  legend.value =
    "Congé fait sans weekend = jours calendaires du congé hors jeudi et vendredi. " +
    "Survolez une cellule de mois pour voir le détail des congés (dates, type, motif).";
  legend.font = { italic: true, size: 9, color: { argb: COLORS.muted } };
  legend.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  ws.getRow(legendRowIdx).height = 28;

  // ===== Largeurs, filtre, impression =====
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 32;
  for (let i = 0; i < matrix.months.length; i++) {
    ws.getColumn(3 + i).width = 13;
  }
  ws.getColumn(totalCol).width = 22;
  ws.getColumn(daysCol).width = 16;

  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: lastDataRow, column: lastCol },
  };

  return (await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
