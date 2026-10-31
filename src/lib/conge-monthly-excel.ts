/**
 * Génération du classeur Excel « Congés — détail par mois » (ExcelJS).
 *
 * Module séparé du composant React pour être testable hors navigateur : le
 * composant ne fait que charger ExcelJS à la demande, appeler ce module puis
 * déclencher le téléchargement.
 *
 * Le classeur contient deux feuilles :
 * 1. « Congés par mois » — matrice employés × mois (jours de congé) ;
 * 2. « Congés par mois avec salaires » — même matrice, enrichie de colonnes de
 *    paie (droit de congé, moyen paie, prime, paie nette…).
 */

import type { Worksheet } from "exceljs";
import { congeDurationExcludingWeekend } from "./conge-days";
import { splitCongeAcrossMonths, type MonthlyMatrix } from "./conge-monthly";
import type { Conge } from "./supabase-helpers";

export type ExcelJSModule = typeof import("exceljs");
type WorkbookInstance = InstanceType<ExcelJSModule["Workbook"]>;

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

export const MONTHLY_SHEET_NAME = "Congés par mois";
export const SALARY_SHEET_NAME = "Congés par mois avec salaires";

/** Base légale de calcul d'un mois de paie (22 jours ouvrés). */
const DAYS_PER_MONTH = 22;
/** Droit de congé acquis par mois travaillé (22 / 12). */
const CONGE_DROIT_PER_MONTH = 1.8333;

const MONEY_FMT = "#,##0.00";

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

/** Valeur d'une cellule de ligne de totaux (formule Excel ou valeur fixe). */
type TotalsValue = string | number | { formula: string } | null;

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

/** 1 → "A", 27 → "AA". */
function colLetter(col: number): string {
  let n = col;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

/** Crée une feuille avec la mise en page commune (paysage, A4, titres figés). */
function addSheet(workbook: WorkbookInstance, name: string): Worksheet {
  const ws = workbook.addWorksheet(name, {
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
  ws.headerFooter.oddFooter = `&L${name}&CPage &P / &N&R&D`;
  return ws;
}

/** Bloc titre + métadonnées (lignes 1 à 5). */
function writeTitleBlock(ws: Worksheet, titleText: string, metaLines: string[], lastCol: number): void {
  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, lastCol);
  const title = ws.getCell(TITLE_ROW, 1);
  title.value = titleText;
  title.font = { bold: true, size: 16, color: { argb: COLORS.white } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.title } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(TITLE_ROW).height = 36;

  metaLines.forEach((line, i) => {
    const rowIdx = META_START_ROW + i;
    ws.mergeCells(rowIdx, 1, rowIdx, lastCol);
    const cell = ws.getCell(rowIdx, 1);
    cell.value = line;
    cell.font = { italic: true, size: 10, color: { argb: COLORS.muted } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });
  ws.getRow(HEADER_ROW - 1).height = 8;
}

/** Ligne d'en-tête à la ligne 6. */
function writeHeaderRow(ws: Worksheet, headers: string[]): void {
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
}

/** Ligne de totaux (gras, fond et bordure renforcés). */
function writeTotalsRow(ws: Worksheet, rowIdx: number, values: TotalsValue[], numFmtFor: (col: number) => string | undefined): void {
  const totalRow = ws.getRow(rowIdx);
  values.forEach((value, i) => {
    const cell = totalRow.getCell(i + 1);
    if (value !== null && value !== undefined) cell.value = value;
    cell.font = { bold: true, size: 11, color: { argb: COLORS.title } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalFill } };
    cell.border = border(COLORS.totalBorder, "medium");
    cell.alignment = {
      vertical: "middle",
      horizontal: i < 2 ? "left" : "center",
      indent: i < 2 ? 1 : 0,
    };
    const fmt = numFmtFor(i + 1);
    if (fmt) cell.numFmt = fmt;
  });
  totalRow.height = 22;
}

/** Légende en bas de feuille. */
function writeLegend(ws: Worksheet, rowIdx: number, lastCol: number, text: string, height = 28): void {
  ws.mergeCells(rowIdx, 1, rowIdx, lastCol);
  const legend = ws.getCell(rowIdx, 1);
  legend.value = text;
  legend.font = { italic: true, size: 9, color: { argb: COLORS.muted } };
  legend.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
  ws.getRow(rowIdx).height = height;
}

function applyAutoFilter(ws: Worksheet, lastDataRow: number, lastCol: number): void {
  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: lastDataRow, column: lastCol },
  };
}

/** Métadonnées communes aux deux feuilles (2 lignes, avant la ligne « Généré le »). */
function periodMetaLines(opts: MonthlyWorkbookOptions): string[] {
  return [
    `Période : du ${fmtDateFR(opts.periodFrom)} au ${fmtDateFR(lastDayOfPeriod(opts.periodTo))}`,
    "Jours de repos exclus : jeudi et vendredi",
  ];
}

/**
 * Feuille « Congés par mois » : matrice employés × mois.
 *
 * Seuls les mois contenant au moins un congé apparaissent en colonne, seuls les
 * employés ayant au moins un congé apparaissent en ligne, et un mois sans congé
 * laisse une cellule vide.
 */
function addMonthlySheet(workbook: WorkbookInstance, matrix: MonthlyMatrix, opts: MonthlyWorkbookOptions, generatedAt: Date): void {
  const { typeLabel } = opts;

  const lastCol = 2 + matrix.months.length + 2;
  const totalCol = 2 + matrix.months.length + 1; // Total sans weekend
  const daysCol = totalCol + 1; // Congé fait

  const ws = addSheet(workbook, MONTHLY_SHEET_NAME);

  writeTitleBlock(
    ws,
    "CONGÉS — DÉTAIL PAR MOIS PAR EMPLOYÉ",
    [
      ...periodMetaLines(opts),
      `Généré le : ${todayFR(generatedAt)} — cellule vide = aucun congé ce mois`,
    ],
    lastCol,
  );

  writeHeaderRow(ws, [
    "MATRICULE",
    "Employé",
    ...matrix.months.map((m) => m.label),
    "Congé fait sans weekend (j)",
    "Congé fait (j)",
  ]);

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
  writeTotalsRow(
    ws,
    totalRowIdx,
    [
      "TOTAL",
      `${matrix.rows.length} employé${matrix.rows.length > 1 ? "s" : ""}`,
      ...matrix.months.map((m) => matrix.totals[m.key]?.workingDays ?? 0),
      matrix.totalWorkingDays,
      matrix.totalDays,
    ],
    (col) => (col >= 3 ? "0" : undefined),
  );

  // ===== Légende =====
  writeLegend(
    ws,
    totalRowIdx + 2,
    lastCol,
    "Congé fait sans weekend = jours calendaires du congé hors jeudi et vendredi. " +
      "Survolez une cellule de mois pour voir le détail des congés (dates, type, motif).",
  );

  // ===== Largeurs, filtre, impression =====
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 32;
  for (let i = 0; i < matrix.months.length; i++) {
    ws.getColumn(3 + i).width = 13;
  }
  ws.getColumn(totalCol).width = 22;
  ws.getColumn(daysCol).width = 16;

  applyAutoFilter(ws, lastDataRow, lastCol);
}

/**
 * Feuille « Congés par mois avec salaires ».
 *
 * Reprend la matrice employés × mois de la première feuille, puis ajoute :
 * - après « Employé » : droit de congé, moyen paie, paie congé, prime, paie net ;
 * - après chaque mois : une colonne « Paie » à remplir manuellement ;
 * - en fin de ligne : total paie congé, cacophat, finale paie.
 *
 * Les colonnes calculées sont de vraies formules Excel : dès que l'utilisateur
 * remplit les colonnes manuelles (moyen paie, prime, paie du mois, cacophat),
 * les résultats se recalculent. Les cellules vides restent vides (pas de 0).
 */
function addSalarySheet(
  workbook: WorkbookInstance,
  matrix: MonthlyMatrix,
  opts: MonthlyWorkbookOptions,
  generatedAt: Date,
): void {
  const { typeLabel } = opts;
  const monthCount = matrix.months.length;

  const FIRST_MONTH_COL = 8; // H
  const daysCol = FIRST_MONTH_COL + 2 * monthCount; // « Congé fait sans weekend »
  const totalDaysCol = daysCol + 1; // « Congé fait »
  const totalPaieCongeCol = daysCol + 2;
  const cacophatCol = daysCol + 3;
  const finalPaieCol = daysCol + 4;
  const lastCol = finalPaieCol;

  const monthCols = matrix.months.map((_, k) => ({
    days: FIRST_MONTH_COL + 2 * k,
    paie: FIRST_MONTH_COL + 2 * k + 1,
  }));

  const ws = addSheet(workbook, SALARY_SHEET_NAME);

  writeTitleBlock(
    ws,
    "CONGÉS PAR MOIS AVEC SALAIRES",
    [
      ...periodMetaLines(opts),
      `Généré le : ${todayFR(generatedAt)} — colonnes vides : Moyen paie, Prime, Paie, Cacophat`,
    ],
    lastCol,
  );

  writeHeaderRow(ws, [
    "MATRICULE",
    "Employé",
    "Droit de congé",
    "Moyen paie",
    "Paie congé",
    "Prime",
    "Paie net",
    ...matrix.months.flatMap((m) => [m.label, "Paie"]),
    "Congé fait sans weekend (j)",
    "Congé fait (j)",
    "Total paie congé",
    "Cacophat",
    "Finale paie",
  ]);

  /** Format numérique par colonne. */
  const numFmtFor = (col: number): string | undefined => {
    if (col <= 2) return undefined;
    if (col === 3) return "0.00"; // Droit de congé
    if (col <= 7) return MONEY_FMT; // Moyen paie → Paie net
    const month = monthCols.find((m) => m.days === col || m.paie === col);
    if (month) return month.days === col ? "0" : MONEY_FMT;
    if (col === daysCol || col === totalDaysCol) return "0";
    return MONEY_FMT;
  };

  const boldCols = new Set([6, daysCol, totalDaysCol, totalPaieCongeCol, finalPaieCol]);

  // ===== Lignes employés =====
  matrix.rows.forEach((row, index) => {
    const rowIdx = FIRST_DATA_ROW + index;
    const excelRow = ws.getRow(rowIdx);
    const striped = index % 2 === 1;

    const c = {
      droit: colLetter(3),
      moyen: colLetter(4),
      paieConge: colLetter(5),
      prime: colLetter(6),
      paieNet: colLetter(7),
    };
    const totalPaieConge = colLetter(totalPaieCongeCol);
    const cacophat = colLetter(cacophatCol);

    const paieCols = monthCols.map((m) => colLetter(m.paie));
    const totalTerms = monthCols
      .map((m) => `(${colLetter(m.days)}${rowIdx}/${DAYS_PER_MONTH})*${colLetter(m.paie)}${rowIdx}`)
      .join("+");

    const values: TotalsValue[] = [
      row.matricule,
      row.name,
      // Droit de congé = mois travaillés × 1,8333 (valeur fixe : « month worked »
      // n'existe pas comme colonne dans cette feuille).
      round2(row.monthWorked * CONGE_DROIT_PER_MONTH),
      null, // Moyen paie — saisie manuelle
      { formula: `IF(${c.moyen}${rowIdx}="","",ROUND(${c.moyen}${rowIdx}/${DAYS_PER_MONTH}*${c.droit}${rowIdx},2))` },
      null, // Prime — saisie manuelle
      { formula: `IF(AND(${c.paieConge}${rowIdx}="",${c.prime}${rowIdx}=""),"",N(${c.paieConge}${rowIdx})+N(${c.prime}${rowIdx}))` },
      ...monthCols.flatMap((_, k) => {
        const cell = row.cells[matrix.months[k].key];
        // Mois sans congé : cellule réellement vide (pas de 0 trompeur)
        return [cell ? cell.workingDays : null, null] as TotalsValue[];
      }),
      row.totalWorkingDays,
      row.totalDays,
      monthCount > 0
        ? { formula: `IF(COUNT(${paieCols.map((p) => `${p}${rowIdx}`).join(",")})=0,"",ROUND(${totalTerms},2))` }
        : null,
      null, // Cacophat — saisie manuelle
      {
        formula: `IF(AND(${c.paieNet}${rowIdx}="",${cacophat}${rowIdx}="",${totalPaieConge}${rowIdx}=""),"",N(${c.paieNet}${rowIdx})-N(${cacophat}${rowIdx})-N(${totalPaieConge}${rowIdx}))`,
      },
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
      const fmt = numFmtFor(i + 1);
      if (fmt) cell.numFmt = fmt;
      if (boldCols.has(i + 1)) cell.font = { bold: true };

      // Commentaire détaillé sur les cellules de mois concernées
      const monthColumn = monthCols.findIndex((m) => m.days === i + 1);
      if (monthColumn >= 0) {
        const month = matrix.months[monthColumn];
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
  const sum = (col: number): TotalsValue => {
    if (matrix.rows.length === 0) return 0;
    const letter = colLetter(col);
    return { formula: `SUM(${letter}${FIRST_DATA_ROW}:${letter}${lastDataRow})` };
  };

  const totalRowIdx = lastDataRow + 1;
  writeTotalsRow(
    ws,
    totalRowIdx,
    [
      "TOTAL",
      `${matrix.rows.length} employé${matrix.rows.length > 1 ? "s" : ""}`,
      sum(3),
      null, // Moyen paie : pas de total (taux)
      sum(5),
      sum(6),
      sum(7),
      ...monthCols.flatMap((m, k) => [matrix.totals[matrix.months[k].key]?.workingDays ?? 0, sum(m.paie)]),
      matrix.totalWorkingDays,
      matrix.totalDays,
      sum(totalPaieCongeCol),
      sum(cacophatCol),
      sum(finalPaieCol),
    ],
    numFmtFor,
  );

  // ===== Légende =====
  writeLegend(
    ws,
    totalRowIdx + 2,
    lastCol,
    "Droit de congé = mois travaillés × 1,8333. " +
      "Paie congé = (Moyen paie / 22) × Droit de congé. Paie net = Prime + Paie congé. " +
      "Total paie congé = somme de (jours du mois / 22 × Paie du mois). " +
      "Finale paie = Paie net − Cacophat − Total paie congé.",
    40,
  );

  // ===== Largeurs, filtre, impression =====
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 14; // Droit de congé
  ws.getColumn(4).width = 14; // Moyen paie
  ws.getColumn(5).width = 14; // Paie congé
  ws.getColumn(6).width = 12; // Prime
  ws.getColumn(7).width = 14; // Paie net
  for (const m of monthCols) {
    ws.getColumn(m.days).width = 13;
    ws.getColumn(m.paie).width = 12;
  }
  ws.getColumn(daysCol).width = 22;
  ws.getColumn(totalDaysCol).width = 16;
  ws.getColumn(totalPaieCongeCol).width = 18;
  ws.getColumn(cacophatCol).width = 14;
  ws.getColumn(finalPaieCol).width = 16;

  applyAutoFilter(ws, lastDataRow, lastCol);
}

/**
 * Construit le classeur et retourne le binaire XLSX prêt à télécharger.
 *
 * Deux feuilles : la matrice employés × mois, puis la même matrice enrichie des
 * colonnes de paie. Les formules de la seconde feuille sont recalculées à
 * l'ouverture du fichier dans Excel.
 */
export async function buildCongeMonthlyWorkbook(
  ExcelJS: ExcelJSModule,
  matrix: MonthlyMatrix,
  opts: MonthlyWorkbookOptions,
): Promise<ArrayBuffer> {
  const generatedAt = opts.generatedAt ?? new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Chrono Docs";
  workbook.created = generatedAt;
  workbook.title = "Congés par mois";
  workbook.calcProperties.fullCalcOnLoad = true;

  addMonthlySheet(workbook, matrix, opts, generatedAt);
  addSalarySheet(workbook, matrix, opts, generatedAt);

  return (await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
