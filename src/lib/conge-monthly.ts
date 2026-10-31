/**
 * Répartition mensuelle des congés pour l'export Excel « Détail par mois ».
 *
 * Module pur (aucun client Supabase) : utilisable dans les tests unitaires.
 * Règle métier identique à `congeDurationExcludingWeekend` / au tableau
 * « Droit de Congé » : les jours de repos (jeudi et vendredi) sont exclus, et
 * seuls les congés commençant dans la période sont retenus — ainsi la somme
 * des mois d'un employé égale exactement sa colonne « Congé fait sans weekend ».
 */

import { CONGE_WEEKEND_DAYS, toUtcDate } from "./conge-days";
import type { DroitCongeRow } from "./conge-utils";
import type { Conge } from "./supabase-helpers";

export const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

/** Clé de mois triable : "2026-01". */
export type MonthKey = string;

export type SplitMonth = {
  monthKey: MonthKey;
  /** Jours calendaires du congé tombant dans ce mois. */
  days: number;
  /** Jours travaillables (hors jeudi/vendredi) tombant dans ce mois. */
  workingDays: number;
};

export type MonthlyCell = {
  days: number;
  workingDays: number;
  /** Congés touchant ce mois (pour le détail en commentaire de cellule). */
  conges: Conge[];
};

export type MonthlyMatrixRow = {
  id: string;
  matricule: string;
  name: string;
  /** Mois travaillés sur l'exercice (repris du tableau « Droit de Congé »). */
  monthWorked: number;
  /** Seules les clés des mois où l'employé a un congé sont présentes. */
  cells: Record<MonthKey, MonthlyCell>;
  totalDays: number;
  totalWorkingDays: number;
};

export type MonthlyMatrix = {
  /** Mois à afficher : uniquement ceux qui contiennent au moins un congé. */
  months: { key: MonthKey; label: string }[];
  rows: MonthlyMatrixRow[];
  totals: Record<MonthKey, { days: number; workingDays: number }>;
  totalDays: number;
  totalWorkingDays: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-01" → "Janvier 2026". */
export function monthLabel(key: MonthKey): string {
  const [year, month] = key.split("-").map(Number);
  const label = MONTH_LABELS[month - 1] ?? key;
  return `${label} ${year}`;
}

/**
 * Découpe un congé en buckets mensuels, en comptant jour par jour.
 *
 * Les dates sont lues en UTC (même convention que `congeDuration`) : le jour
 * de la semaine ne dépend donc pas du fuseau du navigateur.
 */
export function splitCongeAcrossMonths(start: string, end: string): SplitMonth[] {
  const s = toUtcDate(start);
  const e = toUtcDate(end);
  if (!s || !e || e.getTime() < s.getTime()) return [];

  const buckets = new Map<MonthKey, SplitMonth>();
  const cursor = new Date(s.getTime());
  while (cursor.getTime() <= e.getTime()) {
    const key = `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}`;
    const bucket = buckets.get(key) ?? { monthKey: key, days: 0, workingDays: 0 };
    bucket.days += 1;
    if (!CONGE_WEEKEND_DAYS.includes(cursor.getUTCDay())) bucket.workingDays += 1;
    buckets.set(key, bucket);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Array.from(buckets.values());
}

/**
 * Construit la matrice employés × mois.
 *
 * - `rows` : lignes affichées (déjà filtrées par recherche / permissions et
 *   triées) ; l'ordre est conservé.
 * - `conges` : congés bruts ; seuls ceux des employés de `rows` sont retenus.
 * - `opts.from` / `opts.to` : même périmètre que le tableau
 *   (`start_date >= from && start_date < to`), bornes comme dans `droitRows`.
 *
 * Les employés sans congé sur la période sont exclus, et seuls les mois
 * contenant au moins un congé apparaissent en colonne.
 */
export function buildMonthlyCongeMatrix(
  rows: DroitCongeRow[],
  conges: Conge[],
  opts?: { from?: string; to?: string },
): MonthlyMatrix {
  const visibleIds = new Set(rows.map((r) => r.id));
  const inPeriod = conges.filter((c) => {
    if (!visibleIds.has(c.worker_id)) return false;
    if (opts?.from && c.start_date < opts.from) return false;
    if (opts?.to && c.start_date >= opts.to) return false;
    return true;
  });

  const byWorker = new Map<string, Conge[]>();
  for (const conge of inPeriod) {
    const list = byWorker.get(conge.worker_id) ?? [];
    list.push(conge);
    byWorker.set(conge.worker_id, list);
  }

  const matrixRows: MonthlyMatrixRow[] = [];
  const totals: Record<MonthKey, { days: number; workingDays: number }> = {};
  const monthKeys = new Set<MonthKey>();

  for (const row of rows) {
    const workerConges = byWorker.get(row.id);
    if (!workerConges || workerConges.length === 0) continue;

    const cells: Record<MonthKey, MonthlyCell> = {};
    for (const conge of workerConges) {
      for (const bucket of splitCongeAcrossMonths(conge.start_date, conge.end_date)) {
        monthKeys.add(bucket.monthKey);
        const cell = cells[bucket.monthKey] ?? { days: 0, workingDays: 0, conges: [] };
        cell.days += bucket.days;
        cell.workingDays += bucket.workingDays;
        if (!cell.conges.includes(conge)) cell.conges.push(conge);
        cells[bucket.monthKey] = cell;

        const total = totals[bucket.monthKey] ?? { days: 0, workingDays: 0 };
        total.days += bucket.days;
        total.workingDays += bucket.workingDays;
        totals[bucket.monthKey] = total;
      }
    }

    matrixRows.push({
      id: row.id,
      matricule: row.matricule,
      name: row.name,
      monthWorked: row.monthWorked,
      cells,
      totalDays: Object.values(cells).reduce((s, c) => s + c.days, 0),
      totalWorkingDays: Object.values(cells).reduce((s, c) => s + c.workingDays, 0),
    });
  }

  const months = Array.from(monthKeys)
    .sort()
    .map((key) => ({ key, label: monthLabel(key) }));

  return {
    months,
    rows: matrixRows,
    totals,
    totalDays: Object.values(totals).reduce((s, t) => s + t.days, 0),
    totalWorkingDays: Object.values(totals).reduce((s, t) => s + t.workingDays, 0),
  };
}
