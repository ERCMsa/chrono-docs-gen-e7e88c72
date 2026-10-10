import { Link } from "react-router-dom";
import { FilePlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateFR, type SansContratExpiry } from "@/lib/contract-utils";

/** Badge de statut d'échéance implicite, aligné sur les chips d'expiration des contrats. */
function SansContratStatusBadge({ item }: { item: SansContratExpiry }) {
  const urgent = item.status === "expiring";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        urgent
          ? "border-warning/25 bg-warning/15 text-warning"
          : "border-border bg-muted text-muted-foreground",
      )}
      title={`Échéance implicite (embauche + 1 an) : ${formatDateFR(item.virtualEndDate)}`}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", urgent ? "bg-warning animate-pulse-soft" : "bg-muted-foreground/50")} />
      Échéance dans {item.daysLeft} j
    </span>
  );
}

interface SansContratExpiryListProps {
  items: SansContratExpiry[];
  className?: string;
}

/**
 * Employés sans document contrat dont l'échéance implicite (date d'embauche + 1 an)
 * approche ou est dépassée. Complète le bandeau d'expiration : ces employés
 * n'ont aucune ligne dans la liste des documents, il faut donc une section dédiée.
 *
 * L'action proposée est la CRÉATION d'un contrat (et non le renouvellement),
 * ces employés n'ayant pas de contrat précédent à recopier.
 */
export default function SansContratExpiryList({ items, className }: SansContratExpiryListProps) {
  if (!items || items.length === 0) return null;

  const urgentCount = items.filter((i) => i.status === "expiring").length;

  return (
    <section className={cn("panel overflow-hidden", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sans contrat à régulariser
          </h2>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {items.length} employé{items.length > 1 ? "s" : ""}
          {urgentCount > 0 ? ` — ${urgentCount} sous 30 j` : ""}
        </span>
      </header>

      <ul className="divide-y">
        {items.map((item) => {
          const { worker, virtualEndDate, status } = item;
          return (
            <li
              key={worker.id}
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-nowrap",
                status === "expiring" && "bg-warning/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {worker.full_name || "Employé sans nom"}
                  {worker.matricule ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">#{worker.matricule}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Embauche : {worker.hire_date ? formatDateFR(worker.hire_date) : "—"}
                  <span className="mx-1.5 text-muted-foreground/50">•</span>
                  Fin implicite : {formatDateFR(virtualEndDate)}
                </p>
              </div>

              <SansContratStatusBadge item={item} />

              <Link to="/generate/contract" className="shrink-0">
                <Button variant="outline" size="sm">
                  <FilePlus className="mr-2 h-4 w-4" />
                  Créer un contrat
                </Button>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}