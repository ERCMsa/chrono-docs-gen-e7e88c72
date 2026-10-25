/**
 * Calculs partagés des droits de congé.
 *
 * Source de vérité unique pour l'écran « Droit de Congé », l'export Excel et le
 * rapport PDF : évite que les trois affichent un droit de congé différent.
 */

/** Début de la période de congés pris (borne inclusive) : délimite les congés comptés en « Congé fait ». */
export const DROIT_FROM = "2026-01-01";
/** Fin de la période de congés pris (borne exclusive). */
export const DROIT_TO = "2027-01-01";
/** Début de l'exercice servant au calcul des jours travaillés. */
export const PERIOD_START_ISO = "2025-07-01";
/** Fin de l'exercice : date de référence du calcul des jours travaillés. */
export const PERIOD_END_ISO = "2026-06-30";
export const REF_DATE_ISO = PERIOD_END_ISO; // alias, pour ne jamais diverger
export const REF_DATE = new Date(2026, 5, 30); // 2026-06-30

export type CongeEntitlementInput = {
  hire_date?: string | null;
  date_debut_contrat?: string | null;
  date_demission?: string | null;
};

export type CongeEntitlement = {
  enterDate: string | null;
  resignedAt: string | null;
  /** Jours effectivement travaillés sur l'exercice, plafonnés à la démission si elle est comprise dans l'exercice. */
  dayWorked: number;
  monthWorked: number;
  /** Droit de congé acquisitionné : 30 jours pour une année de travail, plafonné à 30. */
  congeDroit: number;
  /** false si l'employé a démissionné avant le début de l'exercice : il est alors exclu des listes. */
  inPeriod: boolean;
};

/**
 * Convertit une date ISO ("YYYY-MM-DD") en Date minuit **local**, dans la même
 * convention que REF_DATE.
 */
function parseLocalIso(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return new Date(iso);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Droit de congé d'un employé, calculé sur l'exercice
 * (PERIOD_START_ISO → PERIOD_END_ISO).
 *
 * `dayWorked` ne compte que les jours réellement travaillés DANS l'exercice :
 * - un employé déjà embauché avant l'exercice est ancré à son début ;
 * - une démission pendant l'exercice plafonne le décompte à la date de démission ;
 * - une démission après la fin de l'exercice n'a aucun effet.
 *
 * Un employé démissionnaire avant le début de l'exercice n'est pas concerné
 * (`inPeriod: false`) : il est retiré des listes.
 *
 * Les dates sont comparées en chaînes ISO ("YYYY-MM-DD"), ce qui évite toute
 * dérive de fuseau horaire, puis converties en minuit local (parseLocalIso) :
 * mélanger new Date(iso) (lu en UTC) et une date locale décalait le
 * Math.floor d'un jour aux bornes.
 */
export function getCongeEntitlement(worker: CongeEntitlementInput): CongeEntitlement {
  const enterDate = worker.hire_date ?? worker.date_debut_contrat ?? null;
  const resignedAt = worker.date_demission ?? null;

  const inPeriod = !(resignedAt && resignedAt < PERIOD_START_ISO);

  // Sans date d'embauche on ne connaît rien de l'acquisition : 0 jour plutôt
  // qu'un exercice complet accordé par défaut.
  const workStart = enterDate && enterDate > PERIOD_START_ISO ? enterDate : PERIOD_START_ISO;
  const cappedByResignation =
    !!resignedAt && resignedAt >= PERIOD_START_ISO && resignedAt <= PERIOD_END_ISO;
  const workEnd = cappedByResignation ? resignedAt : PERIOD_END_ISO;

  // Déjà embauché avant l'exercice : on compte les jours de présence DANS
  // l'exercice, bornes incluses (01/07/2025 → 30/06/2026 = 365 j, donc un
  // exercice complet = 30 j de droit). Embauché pendant l'exercice : on garde
  // l'écart depuis la date d'embauche, pour ne pas modifier les valeurs déjà
  // affichées aux employés en cours d'année.
  const employedBeforePeriod = !!enterDate && enterDate <= PERIOD_START_ISO;

  let dayWorked = 0;
  if (enterDate) {
    const span = Math.floor(
      (parseLocalIso(workEnd).getTime() - parseLocalIso(workStart).getTime()) / 86400000,
    );
    dayWorked = Math.max(0, employedBeforePeriod ? span + 1 : span);
  }

  const mw = dayWorked / 30;
  const monthWorked = mw >= 12 ? 12 : mw < 0 ? 0 : Number(mw.toFixed(1));
  const congeDroit = dayWorked < 365 ? Math.max(0, dayWorked) * (30 / 365) : 30;

  return { enterDate, resignedAt, dayWorked, monthWorked, congeDroit, inPeriod };
}

/**
 * Ligne du tableau « Droit de Congé », telle qu'affichée à l'écran et
 * transmise aux exports Excel (source unique de vérité pour les colonnes).
 */
export type DroitCongeRow = {
  id: string;
  matricule: string;
  name: string;
  monthWorked: number;
  congeFait: number;
  congeFaitHorsWeekend: number;
  congeDroit: number;
  resteConge: number;
  enterDate: string | null;
  inPeriod: boolean;
  resignedAt: string | null;
};
