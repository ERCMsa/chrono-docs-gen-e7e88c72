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

export { formatDateFR } from "./date-utils";
