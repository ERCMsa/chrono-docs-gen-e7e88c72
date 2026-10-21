import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeDepartment } from "@/lib/permissions";
import type { Worker } from "@/lib/supabase-helpers";

interface Props {
  workers: Worker[] | undefined;
  value: string;
  onChange: (workerId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  includeAll?: boolean; // adds an "All employees" option (returns "all")
  allLabel?: string;
  /** Exclut les employés démissionnaires (date_demission renseignée) — sélecteurs de création. */
  excludeResigned?: boolean;
  /**
   * Restreint les options aux employés de ces départements (portée utilisateur).
   * Le département vide est traité comme non accessible.
   */
  allowedDepartments?: string[];
}

/**
 * Reusable employee autocomplete with live filtering by name / matricule.
 * Drop-in replacement for the Select-based employee pickers used across the app.
 */
export default function WorkerAutocomplete({
  workers,
  value,
  onChange,
  placeholder = "Sélectionner un employé...",
  disabled,
  className,
  allowClear = false,
  includeAll = false,
  allLabel = "Tous les employés",
  excludeResigned = false,
  allowedDepartments,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => (value && value !== "all" ? workers?.find((w) => w.id === value) : undefined),
    [workers, value]
  );

  const filtered = useMemo(() => {
    // Le resignataire est retiré des options, sauf s'il est déjà sélectionné :
    // en édition d'un document existant, l'employé doit rester affiché et resélectionnable.
    // Même règle pour la portée départements : l'employé sélectionné reste atteignable.
    const scope = allowedDepartments
      ? new Set(allowedDepartments.map((d) => normalizeDepartment(d)).filter(Boolean))
      : null;
    const list = (workers ?? []).filter((w) => {
      if (excludeResigned && (w as any).date_demission && w.id !== value) return false;
      if (scope) {
        const dept = normalizeDepartment((w as any).department);
        if (!scope.has(dept) && w.id !== value) return false;
      }
      return true;
    });
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 100);
    return list
      .filter((w) => {
        const hay = `${w.full_name ?? ""} ${(w as any).matricule ?? ""} ${w.position ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 100);
  }, [workers, query, excludeResigned, allowedDepartments, value]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQuery("");
  }, [open]);

  const label =
    value === "all" && includeAll
      ? allLabel
      : selected
      ? `${selected.full_name}${(selected as any).matricule ? ` (#${(selected as any).matricule})` : ""}`
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between font-normal",
            !selected && value !== "all" && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, matricule..."
            className="h-10 border-0 shadow-none focus-visible:ring-0 px-0"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="opacity-50 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-auto p-1">
          {includeAll && (
            <button
              type="button"
              onClick={() => { onChange("all"); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent",
                value === "all" && "bg-accent"
              )}
            >
              <Check className={cn("h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
              <span className="font-medium">{allLabel}</span>
            </button>
          )}
          {allowClear && value && value !== "all" && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
              Effacer la sélection
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {excludeResigned && !query.trim() ? "Aucun employé actif" : "Aucun employé trouvé"}
            </p>
          ) : (
            filtered.map((w) => {
              const matricule = (w as any).matricule as string | undefined;
              return (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => { onChange(w.id); setOpen(false); }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-sm px-2 py-2 text-sm text-left hover:bg-accent",
                    value === w.id && "bg-accent"
                  )}
                >
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === w.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{w.full_name}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {matricule ? `#${matricule}` : ""}{matricule && w.position ? " · " : ""}{w.position ?? ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
