/**
 * Calculs de durée des congés, indépendants de Supabase.
 *
 * Ce module est volontairement pur (aucun client réseau) : les écrans,
 * les exports Excel/PDF et les tests unitaires peuvent l'importer sans
 * initialiser le client Supabase. `supabase-helpers` réexporte ces symboles
 * pour ne pas casser les imports existants.
 */

/**
 * Jours de repos retenus par la règle métier : JEUDI et VENDREDI
 * (getUTCDay() : 4 = jeudi, 5 = vendredi).
 */
export const CONGE_WEEKEND_DAYS: readonly number[] = [4, 5];

/**
 * Convertit une date ISO ("YYYY-MM-DD") en Date UTC.
 * Les dates de congé sont des dates calendaires : on travaille donc en UTC
 * pour que le jour de la semaine ne dépende pas du fuseau du navigateur.
 */
export function toUtcDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** True si la date tombe un jour de repos (jeudi ou vendredi). */
export function isCongeWeekend(iso: string): boolean {
  const dt = toUtcDate(iso);
  return dt ? CONGE_WEEKEND_DAYS.includes(dt.getUTCDay()) : false;
}

/** Nombre de jours calendaires d'un congé, bornes incluses. */
export function congeDuration(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Durée d'un congé en jours TRAVAILLABLES, c'est-à-dire en excluant les jours
 * de repos (jeudi et vendredi). Même convention bornes inclusives que
 * `congeDuration`, dont le résultat est toujours >= celui-ci.
 */
export function congeDurationExcludingWeekend(start: string, end: string): number {
  const s = toUtcDate(start);
  const e = toUtcDate(end);
  if (!s || !e || e.getTime() < s.getTime()) return 0;
  let count = 0;
  const cursor = new Date(s.getTime());
  while (cursor.getTime() <= e.getTime()) {
    if (!CONGE_WEEKEND_DAYS.includes(cursor.getUTCDay())) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
