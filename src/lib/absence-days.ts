/**
 * Expansion des périodes d'absence en jours travaillables.
 *
 * La règle métier est la même que pour les congés : JEUDI et VENDREDI sont
 * des jours de repos. Les dates sont des dates calendaires (ISO YYYY-MM-DD)
 * traitées en UTC afin que le jour de la semaine ne dépende pas du fuseau
 * du navigateur.
 */
import { CONGE_WEEKEND_DAYS, toUtcDate } from "./conge-days";

/** Jours non travaillés : jeudi (4) et vendredi (5), comme les congés. */
export const ABSENCE_NON_WORKING_DAYS: readonly number[] = CONGE_WEEKEND_DAYS;

/** True si la date ISO tombe un jeudi ou un vendredi. */
export function isAbsenceNonWorkingDay(iso: string): boolean {
  const dt = toUtcDate(iso);
  return dt ? ABSENCE_NON_WORKING_DAYS.includes(dt.getUTCDay()) : false;
}

function toIso(dt: Date): string {
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Retourne toutes les dates ISO de la période [start, end] (bornes incluses)
 * en excluant les jours de repos.
 *
 * Une date unique (end absent ou égal à start) est toujours retournée, même
 * si elle tombe un jeudi ou un vendredi : l'utilisateur l'a choisie
 * explicitement. L'exclusion ne s'applique donc qu'aux intervalles.
 */
export function expandAbsenceDays(start: string, end?: string): string[] {
  const startDate = toUtcDate(start);
  if (!startDate) return [];

  const endDate = end ? toUtcDate(end) : startDate;
  if (!endDate || endDate.getTime() < startDate.getTime()) return [];

  // Date unique : on honore le choix explicite de l'utilisateur.
  if (startDate.getTime() === endDate.getTime()) {
    return [toIso(startDate)];
  }

  const days: string[] = [];
  const cursor = new Date(startDate.getTime());
  while (cursor.getTime() <= endDate.getTime()) {
    if (!ABSENCE_NON_WORKING_DAYS.includes(cursor.getUTCDay())) {
      days.push(toIso(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
