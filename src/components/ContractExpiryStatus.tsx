import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/date-utils";
import {
  getContractExpiry,
  latestContractsByWorker,
  type ContractDocLike,
  type ContractExpiry,
  type ExpiryFilter,
  type SansContratExpiry,
} from "@/lib/contract-utils";

const BADGE_STYLES: Record<ContractExpiry, { wrap: string; dot: string }> = {
  ok: {
    wrap: "border-success/20 bg-success/10 text-success dark:border-success/30 dark:bg-success/10 dark:text-success",
    dot: "bg-success",
  },
  expiring: {
    wrap: "border-warning/25 bg-warning/15 text-warning dark:border-warning/30 dark:bg-warning/15 dark:text-warning",
    dot: "bg-warning animate-pulse-soft",
  },
  expired: {
    wrap: "border-destructive/20 bg-destructive/10 text-destructive animate-pulse-alert dark:border-destructive/30 dark:bg-destructive/10 dark:text-destructive",
    dot: "bg-destructive",
  },
};

/** Badge de statut d'expiration affiché sur chaque ligne de contrat. */
export function ContractExpiryBadge({ content, className }: { content: unknown; className?: string }) {
  const expiry = getContractExpiry(content);
  if (!expiry) return <span className="text-xs text-muted-foreground">—</span>;

  const styles = BADGE_STYLES[expiry.status];
  const label =
    expiry.status === "ok"
      ? "En cours"
      : expiry.status === "expiring"
        ? `Expire dans ${expiry.daysLeft} j`
        : `Expiré depuis ${expiry.daysOver} j`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        styles.wrap,
        className,
      )}
      title={`Expiration du contrat : ${formatDateFR(expiry.endDate)}`}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}

function ExpiryChip({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-foreground/40 bg-foreground/5 ring-1 ring-inset ring-foreground/20"
          : "hover:bg-muted/60",
        count === 0 && "opacity-45 cursor-not-allowed",
      )}
      title={label}
      disabled={count === 0}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      <span className="tabular-nums">{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** Bandeau récapitulatif cliquable : combien de contrats sont en cours / expirent bientôt / expirés. */
export function ContractExpirySummary({
  documents,
  active,
  onSelect,
  sansContrat,
  className,
}: {
  documents: ContractDocLike[];
  active: ExpiryFilter;
  onSelect: (s: ExpiryFilter) => void;
  /** Échéances implicites des employés sans contrat (statuts expiring/expired uniquement). */
  sansContrat?: Pick<SansContratExpiry, "status">[];
  className?: string;
}) {
  const counts = useMemo(() => {
    // Seul le contrat le plus récent de chaque employé compte : un contrat
    // renouvelé ne doit plus être considéré comme expiré.
    const latestContracts = [...latestContractsByWorker(documents).values()];
    let ok = 0;
    let expiring = 0;
    let expired = 0;
    for (const doc of latestContracts) {
      const e = getContractExpiry(doc.content);
      if (e?.status === "ok") ok++;
      else if (e?.status === "expiring") expiring++;
      else if (e?.status === "expired") expired++;
    }
    // Les employés sans contrat comptent avec leur échéance implicite (embauche + 1 an)
    for (const item of sansContrat ?? []) {
      if (item.status === "expiring") expiring++;
      else if (item.status === "expired") expired++;
    }
    return { ok, expiring, expired, total: ok + expiring + expired };
  }, [documents, sansContrat]);

  if (counts.total === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3", className)}>
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Expiration des contrats
      </span>
      <ExpiryChip
        label="en cours"
        count={counts.ok}
        dot="bg-green-500"
        active={active === "ok"}
        onClick={() => onSelect(active === "ok" ? "all" : "ok")}
      />
      <ExpiryChip
        label="expirent bientôt"
        count={counts.expiring}
        dot="bg-orange-500 animate-pulse-soft"
        active={active === "expiring"}
        onClick={() => onSelect(active === "expiring" ? "all" : "expiring")}
      />
      <ExpiryChip
        label="expirés"
        count={counts.expired}
        dot="bg-red-500 animate-pulse-alert"
        active={active === "expired"}
        onClick={() => onSelect(active === "expired" ? "all" : "expired")}
      />
      {active !== "all" && (
        <button
          type="button"
          onClick={() => onSelect("all")}
          className="ml-auto text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}