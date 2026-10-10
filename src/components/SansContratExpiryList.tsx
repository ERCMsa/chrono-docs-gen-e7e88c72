import { Link } from "react-router-dom";
import { FilePlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateFR, type ExpiryFilter, type SansContratExpiry } from "@/lib/contract-utils";

type SansContratStatus = SansContratExpiry["status"];

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
      Échéance dans {item.daysLeft} j
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
}

interface SansContratExpiryListProps {
  items: SansContratExpiry[];
  /** Filtre d'expiration actif : la liste ne montre que les employés de cet état. */
  active?: ExpiryFilter;
  className?: string;
}

/** Regroupement par état : chaque employé est affiché sous SON état. */
const GROUPS: Array<{ key: SansContratStatus; label: string; hint: string; dot: string }> = [
  {
    key: "expiring",
    label: "Échéance proche",
    hint: "30 jours ou moins",
    dot: "bg-warning animate-pulse-soft",
  },
  {
    key: "ok",
    label: "Échéance plus lointaine",
    hint: "plus de 30 jours",
    dot: "bg-muted-foreground/50",
  },
];

/**
 * Employés sans document contrat dont l'échéance implicite (date d'embauche + 1 an)
 * est atteinte ou dépassée. Complète le bandeau d'expiration : ces employés
 * n'ont aucune ligne dans la liste des documents, il faut donc une section dédiée.
 *
 * La section suit le filtre d'expiration actif : un employé n'apparaît que sous
 * SON état (filtre « expirent bientôt » → uniquement les échéances proches).
 *
 * L'action proposée est la CRÉATION d'un contrat (et non le renouvellement),
 * ces employés n'ayant pas de contrat précédent à recopier.
 */
export default function SansContratExpiryList({ items, active = "all", className }: SansContratExpiryListProps) {
  const visible = (items ?? []).filter((i) => active === "all" || i.status === active);
  if (visible.length === 0) return null;

  const groups = GROUPS.map((group) => ({
    ...group,
    items: visible.filter((i) => i.status === group.key),
  })).filter((group) => group.items.length > 0);

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

      {groups.map((group) => (
        <div key={group.key}>
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", group.dot)} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              {group.label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {group.items.length}
            </span>
            <span className="text-xs text-muted-foreground">{group.hint}</span>
          </div>
          <ul className="divide-y">
            {group.items.map((item) => (
              <SansContratRow key={item.worker.id} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}