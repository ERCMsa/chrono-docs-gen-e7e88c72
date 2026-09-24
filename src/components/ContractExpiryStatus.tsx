import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/date-utils";
import {
  getContractExpiry,
  type ContractExpiry,
  type ExpiryFilter,
} from "@/lib/contract-utils";

const BADGE_STYLES: Record<ContractExpiry, { wrap: string; dot: string }> = {
  ok: {
    wrap: "border-green-200 bg-green-50 text-green-700 dark:border-green-500/25 dark:bg-green-500/10 dark:text-green-300",
    dot: "bg-green-500",
  },
  expiring: {
    wrap: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
    dot: "bg-orange-500 animate-pulse-soft",
  },
  expired: {
    wrap: "border-red-300 bg-red-50 text-red-700 animate-pulse-alert dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
    dot: "bg-red-500",
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
  className,
}: {
  documents: { content: unknown }[];
  active: ExpiryFilter;
  onSelect: (s: ExpiryFilter) => void;
  className?: string;
}) {
  const counts = useMemo(() => {
    let ok = 0;
    let expiring = 0;
    let expired = 0;
    for (const doc of documents) {
      const e = getContractExpiry(doc.content);
      if (e?.status === "ok") ok++;
      else if (e?.status === "expiring") expiring++;
      else if (e?.status === "expired") expired++;
    }
    return { ok, expiring, expired, total: ok + expiring + expired };
  }, [documents]);

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