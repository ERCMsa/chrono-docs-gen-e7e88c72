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
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Restreint les options aux employés de ces départements (portée utilisateur).
   * Les employés déjà sélectionnés restent listés afin de pouvoir les retirer.
   */
  allowedDepartments?: string[];
}

export default function WorkerMultiSelect({
  workers,
  value,
  onChange,
  placeholder = "Sélectionner des employés...",
  disabled,
  className,
  allowedDepartments,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const scope = allowedDepartments
      ? new Set(allowedDepartments.map((d) => normalizeDepartment(d)).filter(Boolean))
      : null;
    const list = (workers ?? []).filter((w) => {
      if (!scope) return true;
      // Un employé déjà sélectionné reste toujours visible/retirable.
      if (selectedSet.has(w.id)) return true;
      const dept = normalizeDepartment((w as any).department);
      return scope.has(dept);
    });
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 200);
    return list
      .filter((w) => {
        const hay = `${w.full_name ?? ""} ${(w as any).matricule ?? ""} ${w.position ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200);
  }, [workers, query, allowedDepartments, selectedSet]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQuery("");
  }, [open]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((w) => selectedSet.has(w.id));
  const selectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filtered.map((w) => w.id));
      onChange(value.filter((v) => !visibleIds.has(v)));
    } else {
      const merged = new Set(value);
      filtered.forEach((w) => merged.add(w.id));
      onChange(Array.from(merged));
    }
  };

  const label = value.length === 0 ? placeholder : `${value.length} employé${value.length > 1 ? "s" : ""} sélectionné${value.length > 1 ? "s" : ""}`;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("h-11 w-full justify-between font-normal", value.length === 0 && "text-muted-foreground")}
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
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
          <div className="flex items-center justify-between px-3 py-1.5 border-b">
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-xs font-medium text-primary hover:underline"
            >
              {allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:underline">
                Vider ({value.length})
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun employé trouvé</p>
            ) : (
              filtered.map((w) => {
                const matricule = (w as any).matricule as string | undefined;
                const isSel = selectedSet.has(w.id);
                return (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => toggle(w.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-sm px-2 py-2 text-sm text-left hover:bg-accent",
                      isSel && "bg-accent"
                    )}
                  >
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", isSel ? "opacity-100" : "opacity-0")} />
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
    </div>
  );
}
