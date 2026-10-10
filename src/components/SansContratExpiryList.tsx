import { Link } from "react-router-dom";
import { FilePlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateFR, type ExpiryFilter, type SansContratExpiry } from "@/lib/contract-utils";
import { format } from "date-fns"

/** Badges de statut d'échéance implicite, alignés sur les chips d'expiration des contrats. */
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
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          urgent ? "bg-warning animate-pulse-soft" : "bg-muted-foreground/50",
        )}
      />
      expirés in {format(new Date(item.virtualEndDate), 'dd/MM')}
    </span>
  );
}

function SansContratRow({ item }: { item: SansContratExpiry }) {
  const { worker, virtualEndDate, status } = item;
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-nowrap",
        status === "expiring" && "bg-warning/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <Link
          to={`/workers/${worker.id}`}
          className="block truncate text-sm font-medium hover:text-primary hover:underline"
        >
          {worker.full_name || "Employé sans nom"}
          {worker.matricule ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">#{worker.matricule}</span>
          ) : null}
        </Link>
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
}

interface SansContratExpiryListProps {
  items: SansContratExpiry[];
  /** Filtre d'expiration actif : la section s'affiche dans « en cours ». */
  active?: ExpiryFilter;
  className?: string;
}

/**
 * Employés sans document contrat dont l'échéance implicite (date d'embauche + 1 an)
 * est atteinte ou dépassée. Complète le bandeau d'expiration : ces employés
 * n'ont aucune ligne dans la liste des documents, il faut donc une section dédiée.
 *
 * La section s'affiche dans le filtre « en cours » et liste TOUS les employés
 * concernés, sans filtrage par état, triés par nombre de jours de retard
 * décroissant (le plus ancien retard en tête).
 *
 * L'action proposée est la CRÉATION d'un contrat (et non le renouvellement),
 * ces employés n'ayant pas de contrat précédent à recopier.
 */
export default function SansContratExpiryList({ items, active = "all", className }: SansContratExpiryListProps) {
  // Affiché uniquement dans le filtre « en cours »
  if (active !== "ok") return null;

  // Aucun filtrage par état : tri du plus gros retard au plus petit
  const visible = [...(items ?? [])].sort((a, b) => b.daysOver - a.daysOver);
  if (visible.length === 0) return null;

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
          {visible.length} employé{visible.length > 1 ? "s" : ""}
        </span>
      </header>

      <ul className="divide-y">
       {[...visible]
         .sort((a, b) => b.daysLeft - a.daysLeft)
         .map((item) => (
        <SansContratRow key={item.worker.id} item={item} />
        ))}
      </ul>
    </section>
  );
}