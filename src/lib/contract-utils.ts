export const CONTRACT_DURATIONS = [
  { value: "1_mois", label: "1 mois", months: 1 },
  { value: "3_mois", label: "3 mois", months: 3 },
  { value: "6_mois", label: "6 mois", months: 6 },
  { value: "1_an", label: "1 an", months: 12 },
  { value: "2_ans", label: "2 ans", months: 24 },
] as const;

export type ContractDurationValue = typeof CONTRACT_DURATIONS[number]["value"];

export function durationLabel(value?: string | null) {
  return CONTRACT_DURATIONS.find((d) => d.value === value)?.label ?? "—";
}

export function computeEndDate(start: string, duration: string): string {
  const monthsAdd = CONTRACT_DURATIONS.find((d) => d.value === duration)?.months ?? 0;
  if (!start || !monthsAdd) return "";
  const d = new Date(start);
  d.setMonth(d.getMonth() + monthsAdd);
  // Subtract one day so a "1 month" contract starting Jan 1 ends Jan 31
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type ContractStatus =
  | { kind: "none" }
  | { kind: "active"; endDate: string; daysLeft: number }
  | { kind: "expiring"; endDate: string; daysLeft: number }
  | { kind: "expired"; endDate: string; daysOver: number };

export function getContractStatus(endDateStr?: string | null): ContractStatus {
  if (!endDateStr) return { kind: "none" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr); end.setHours(0, 0, 0, 0);
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { kind: "expired", endDate: endDateStr, daysOver: -diffDays };
  if (diffDays <= 30) return { kind: "expiring", endDate: endDateStr, daysLeft: diffDays };
  return { kind: "active", endDate: endDateStr, daysLeft: diffDays };
}

// ===== Expiration des contrats (documents) =====
/** Statut d'expiration d'un document contrat : verte / orange (bientôt) / rouge (expiré). */
export type ContractExpiry = "ok" | "expiring" | "expired";
export type ExpiryFilter = "all" | ContractExpiry;

export type ContractExpiryInfo =
  | { status: "ok"; endDate: string; daysLeft: number }
  | { status: "expiring"; endDate: string; daysLeft: number }
  | { status: "expired"; endDate: string; daysOver: number };

/** Extrait la date de fin (`date_fin`) du contenu d'un document contrat. */
export function getContractEndDate(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const fin = (content as Record<string, unknown>).date_fin;
  return typeof fin === "string" && fin.length >= 8 ? fin : null;
}

/** Calcule le statut d'expiration à partir du contenu d'un document. */
export function getContractExpiry(content: unknown): ContractExpiryInfo | null {
  const endDate = getContractEndDate(content);
  if (!endDate) return null;
  const st = getContractStatus(endDate);
  if (st.kind === "expired") return { status: "expired", endDate, daysOver: st.daysOver };
  if (st.kind === "expiring") return { status: "expiring", endDate, daysLeft: st.daysLeft };
  if (st.kind === "active") return { status: "ok", endDate, daysLeft: st.daysLeft };
  return null;
}

// ===== Dernier contrat par employé =====
// Un renouvellement conserve l'ancien document : seul le contrat le plus récent
// d'un employé doit piloter le statut d'expiration, sinon un contrat renouvelé
// continuerait d'apparaître comme « expiré ».
export type ContractDocLike = {
  id?: string | null;
  worker_id?: string | null;
  document_type?: string | null;
  created_at?: string | null;
  content?: unknown;
};

/**
 * Associe chaque `worker_id` à son contrat le plus récent.
 * Les documents non-contrat (bons, avertissements) sont ignorés.
 * Le plus récent est retenu via `created_at` ; à défaut, le premier document
 * rencontré gagne (les requêtes existantes sont déjà ordonnées `created_at` décroissant).
 */
export function latestContractsByWorker<T extends ContractDocLike>(
  documents: T[] | null | undefined,
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const doc of documents ?? []) {
    if (!doc || doc.document_type !== "contract") continue;
    const workerId = doc.worker_id;
    if (!workerId) continue;
    const current = latest.get(workerId);
    if (!current) {
      latest.set(workerId, doc);
      continue;
    }
    const a = typeof doc.created_at === "string" ? doc.created_at : "";
    const b = typeof current.created_at === "string" ? current.created_at : "";
    if (b && a && a > b) latest.set(workerId, doc);
  }
  return latest;
}

// ===== Employés sans contrat =====
// Des employés importés en données historiques n'ont aucun document contrat.
// Leur échéance implicite est calculée à partir de la date d'embauche (+ 1 an),
// ce qui permet de les alerter au même moment que les contrats réels.
export type SansContratWorkerLike = {
  id: string;
  full_name?: string | null;
  matricule?: string | null;
  hire_date?: string | null;
  date_demission?: string | null;
};

export type SansContratExpiry = {
  worker: SansContratWorkerLike;
  /** Fin du contrat virtuel (1 an après l'embauche). */
  virtualEndDate: string;
  /** « expiring » quand l'échéance du cycle est proche (≤ 30 j), sinon « ok ». */
  status: Extract<ContractExpiry, "expiring" | "ok">;
  /** Jours restants avant l'échéance du cycle annuel courant. */
  daysLeft: number;
  /** Jours réellement écoulés depuis la fin implicite. */
  daysOver: number;
};

/** Seuil « échéance proche », aligné sur getContractStatus. */
const EXPIRING_DAYS = 30;

/**
 * Employés sans document contrat dont l'échéance implicite (embauche + 1 an)
 * est atteinte ou dépassée.
 *
 * L'échéance est ramenée dans le cycle annuel courant : au-delà d'une année de
 * retard, ce sont les jours restants dans l'année en cours qui déterminent
 * l'urgence (ex. 2623 j de retard => 2623 % 365 = 68 j restants). Le statut
 * « expiring » (≤ 30 j) sert uniquement à prioriser l'alerte.
 *
 * - Ignorés : employés sans date d'embauche (échéance non calculable),
 *   employés démissionnaires (`date_demission` renseignée) et ceux dont
 *   l'échéance implicite est encore dans le futur.
 */
export function getSansContratExpiries(
  workers: SansContratWorkerLike[] | null | undefined,
  workerIdsWithContract: Set<string> | null | undefined,
): SansContratExpiry[] {
  const out: SansContratExpiry[] = [];
  for (const worker of workers ?? []) {
    if (!worker?.id) continue;
    if (workerIdsWithContract?.has(worker.id)) continue;
    if (worker.date_demission) continue;
    if (!worker.hire_date) continue;

    const virtualEndDate = computeEndDate(worker.hire_date, "1_an");
    if (!virtualEndDate) continue;

    const status = getContractStatus(virtualEndDate);
    // Échéance encore lointaine : rien à signaler
    if (status.kind === "active") continue;

    let daysLeft: number;
    let daysOver = 0;
    if (status.kind === "expiring") {
      daysLeft = status.daysLeft;
    } else if (status.kind === "expired") {
      // Cycle annuel : on repart du reste de l'année de retard en cours.
      daysOver = status.daysOver;
      daysLeft = status.daysOver % 365;
    } else {
      continue;
    }

    out.push({
      worker,
      virtualEndDate,
      status: daysLeft <= EXPIRING_DAYS ? "expiring" : "ok",
      daysLeft,
      daysOver,
    });
  }
  // Échéance la plus proche en premier
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export { formatDateFR } from "./date-utils";
