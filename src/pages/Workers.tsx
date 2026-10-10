import { DateInput } from "@/components/ui/date-input";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkers, createWorker, getWorkerIdsWithContract, type WorkerInsert } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, Search, Shield, Upload, Pencil, AlertTriangle, XCircle, Building2, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import ImportWorkersDialog from "@/components/ImportWorkersDialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListRowsSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTRACT_DURATIONS, computeEndDate, getContractStatus, formatDateFR } from "@/lib/contract-utils";
import { DEPARTMENTS } from "@/lib/departments";
import { useAuth } from "@/contexts/AuthContext";

const emptyWorker: WorkerInsert = {
  full_name: "", phone: "", position: "", department: "", address: "", matricule: "",
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

type SortKey = "full_name" | "matricule" | "position" | "department" | "hire_date" | "status";

export default function Workers() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { role, isAdmin } = useAuth();
  const isGlobal = isAdmin() || role === "RH";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ ...emptyWorker });
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  // Advanced filters (applied to both cards and list views)
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sexeFilter, setSexeFilter] = useState<string>("all");
  const [contractFilter, setContractFilter] = useState<"all" | "active" | "none">("all");
  const [hireFrom, setHireFrom] = useState("");
  const [hireTo, setHireTo] = useState("");
  const [view, setView] = useState("cards");
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [importOpen, setImportOpen] = useState(false);
  const { data: workers, isLoading } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: contractWorkerIds } = useQuery({ queryKey: ["workers-with-contract"], queryFn: getWorkerIdsWithContract });

  const positionOptions = useMemo(
    () => [...new Set((workers ?? []).map((w) => w.position ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [workers],
  );
  const departmentOptions = useMemo(
    () => [...new Set((workers ?? []).map((w) => w.department ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [workers],
  );

  const DATE_FIELDS = ["date_naissance", "hire_date", "date_debut_contrat", "date_fin_contrat", "date_demission"];
  const sanitize = (obj: Record<string, any>) => {
    const out: Record<string, any> = { ...obj };
    for (const k of DATE_FIELDS) {
      if (out[k] === "" || out[k] === undefined) out[k] = null;
    }
    return out;
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: any = { ...form, is_department_head: isDeptHead };
      // hire_date sert de date de début de contrat
      payload.date_debut_contrat = form.hire_date || null;
      if (form.duree_contrat && form.hire_date) {
        payload.date_fin_contrat = computeEndDate(form.hire_date, form.duree_contrat);
      } else {
        payload.date_fin_contrat = null;
      }
      return createWorker(sanitize(payload) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      setOpen(false);
      setForm({ ...emptyWorker });
      setIsDeptHead(false);
      toast.success("Employé ajouté");
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name?.trim()) { toast.error("Le nom est requis"); return; }
    createMutation.mutate();
  };

  const updateField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const filtered = workers?.filter((w) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      w.full_name.toLowerCase().includes(q) ||
      (w.position ?? "").toLowerCase().includes(q) ||
      (w.department ?? "").toLowerCase().includes(q) ||
      (w.phone ?? "").toLowerCase().includes(q) ||
      (w.matricule ?? "").toLowerCase().includes(q)
    );
    const hasDemission = !!(w as any).date_demission;
    const matchesStatus =
      statusFilter === "all" ? true :
      statusFilter === "inactive" ? hasDemission : !hasDemission;

    const matchesPosition = positionFilter === "all" || (w.position ?? "") === positionFilter;
    const matchesDepartment = departmentFilter === "all" || (w.department ?? "") === departmentFilter;
    const matchesSexe = sexeFilter === "all" || (w.sexe ?? "") === sexeFilter;
    const hasContract = contractWorkerIds?.has(w.id) ?? false;
    const matchesContract =
      contractFilter === "all" ? true :
      contractFilter === "active" ? hasContract : !hasContract;
    const hireDate = w.hire_date ?? (w as any).date_debut_contrat;
    const matchesHire =
      (!hireFrom || (!!hireDate && hireDate >= hireFrom)) &&
      (!hireTo || (!!hireDate && hireDate <= hireTo));

    return matchesSearch && matchesStatus && matchesPosition && matchesDepartment &&
      matchesSexe && matchesContract && matchesHire;
  });

  const sortedWorkers = [...(filtered ?? [])].sort((a, b) => {
    const statusValue = (worker: typeof a) => {
      if ((worker as any).date_demission) return "3-démission";
      return contractWorkerIds?.has(worker.id) ? "1-contrat actif" : "2-sans contrat";
    };
    const value = (worker: typeof a): string | number => {
      if (sortKey === "status") return statusValue(worker);
      // La date d'embauche est renvoyée telle quelle (format ISO, tri chronologique)
      if (sortKey === "hire_date") {
        const hire = worker.hire_date ?? (worker as any).date_debut_contrat;
        return hire ? String(hire) : "";
      }
      // Matricule contains numbers -> sort numerically, not as strings
      if (sortKey === "matricule") {
        const digits = String(worker[sortKey] ?? "").replace(/\D/g, "");
        const num = digits === "" ? 0 : Number(digits);
        return Number.isFinite(num) ? num : 0;
      }
      return String(worker[sortKey] ?? "");
    };
    const va = value(a);
    const vb = value(b);
    // Sans date d'embauche : toujours en fin de liste (ascendant comme descendant)
    if (sortKey === "hire_date" && va !== vb && (va === "" || vb === "")) {
      return va === "" ? 1 : -1;
    }
    const comparison =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "fr", { sensitivity: "base" });
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const hasActiveFilters =
    positionFilter !== "all" || departmentFilter !== "all" || sexeFilter !== "all" ||
    contractFilter !== "all" || !!hireFrom || !!hireTo;

  const resetFilters = () => {
    setPositionFilter("all");
    setDepartmentFilter("all");
    setSexeFilter("all");
    setContractFilter("all");
    setHireFrom("");
    setHireTo("");
  };

  const SortHeader = ({ column, children, className = "" }: { column: SortKey; children: React.ReactNode; className?: string }) => {
    const active = sortKey === column;
    const Icon = !active ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className}`} aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
          {children} <Icon className="h-3.5 w-3.5" />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employés"
        description={isGlobal ? "Gérez vos employés" : "Employés de votre département"}
      >
        {!isGlobal && role && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Building2 className="w-3.5 h-3.5" /> Département : {role}
          </span>
        )}
        {/* <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />Importer Excel
        </Button> */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Nouvel employé</DialogTitle>
              <DialogDescription>Remplissez les informations du nouvel employé.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-2">
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Information Personnelle</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Matricule</Label>
                    <Input value={form.matricule ?? ""} onChange={(e) => updateField("matricule", e.target.value)} placeholder="Ex: EMP-001" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nom *</Label>
                    <Input value={form.full_name ?? ""} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Nom et prénom" className="h-11" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Adresse</Label>
                    <Input value={form.address ?? ""} onChange={(e) => updateField("address", e.target.value)} placeholder="Adresse complète" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date de Naissance</Label>
                    <DateInput value={form.date_naissance ?? ""} onChange={(e) => updateField("date_naissance", e.target.value)} className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Lieu de Naissance</Label>
                    <Input value={form.lieu_naissance ?? ""} onChange={(e) => updateField("lieu_naissance", e.target.value)} placeholder="Ex: Casablanca" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Situation Familiale</Label>
                    <Select value={form.situation_familiale ?? ""} onValueChange={(v) => updateField("situation_familiale", v)}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Célibataire">Célibataire</SelectItem>
                        <SelectItem value="Marié(e)">Marié(e)</SelectItem>
                        <SelectItem value="Divorcé(e)">Divorcé(e)</SelectItem>
                        <SelectItem value="Veuf(ve)">Veuf(ve)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Sexe</Label>
                    <Select value={form.sexe ?? ""} onValueChange={(v) => updateField("sexe", v)}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculin">Masculin</SelectItem>
                        <SelectItem value="Féminin">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Téléphone</Label>
                    <Input value={form.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} placeholder="Ex: 06 12 34 56 78" className="h-11" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Information De Fonction</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Fonction</Label>
                    <Input value={form.position ?? ""} onChange={(e) => updateField("position", e.target.value)} placeholder="Ex: Technicien" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Département</Label>
                    <Select value={form.department ?? ""} onValueChange={(v) => updateField("department", v)}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner un département" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date de Recrutement</Label>
                    <DateInput value={form.hire_date ?? ""} onChange={(e) => updateField("hire_date", e.target.value)} className="h-11" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Contrat</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Durée</Label>
                    <Select value={form.duree_contrat ?? ""} onValueChange={(v) => updateField("duree_contrat", v)}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {CONTRACT_DURATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date fin (auto)</Label>
                    <DateInput disabled value={(form.duree_contrat && form.hire_date) ? computeEndDate(form.hire_date, form.duree_contrat) : ""} className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date démission</Label>
                    <DateInput value={(form as any).date_demission ?? ""} onChange={(e) => updateField("date_demission" as any, e.target.value)} className="h-11" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Numéro Identité</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Numéro Social</Label>
                    <Input value={form.numero_social ?? ""} onChange={(e) => updateField("numero_social", e.target.value)} placeholder="0" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Numéro de Compte</Label>
                    <Input value={form.numero_compte ?? ""} onChange={(e) => updateField("numero_compte", e.target.value)} placeholder="0" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Acte de Naissance</Label>
                    <Input value={form.acte_naissance ?? ""} onChange={(e) => updateField("acte_naissance", e.target.value)} placeholder="Numéro" className="h-11" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Switch checked={isDeptHead} onCheckedChange={setIsDeptHead} />
                <div>
                  <Label className="cursor-pointer font-medium">Responsable de département</Label>
                  <p className="text-xs text-muted-foreground">Cet employé est chef de service</p>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Ajout..." : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <ImportWorkersDialog open={importOpen} onOpenChange={setImportOpen} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un employé (nom, poste, matricule...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-11 sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les employés</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Non actifs (démission)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters */}
      <div className="flex flex-wrap items-end gap-3 panel p-4">
        <div className="w-40 space-y-1.5">
          <Label className="field-label">Fonction</Label>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {positionOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="w-44 space-y-1.5">
          <Label className="field-label">Département</Label>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {departmentOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="field-label">Date d'embauche</Label>
          <div className="flex items-center gap-2">
            <DateInput value={hireFrom} onChange={(e) => setHireFrom(e.target.value)} placeholder="Du jj/mm/aaaa" className="w-32 h-10" />
            <span className="text-muted-foreground">—</span>
            <DateInput value={hireTo} onChange={(e) => setHireTo(e.target.value)} placeholder="Au jj/mm/aaaa" className="w-32 h-10" />
          </div>
        </div>

        <div className="w-36 space-y-1.5">
          <Label className="field-label">Sexe</Label>
          <Select value={sexeFilter} onValueChange={setSexeFilter}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="Masculin">Masculin</SelectItem>
              <SelectItem value="Féminin">Féminin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-44 space-y-1.5">
          <Label className="field-label">Contrat</Label>
          <Select value={contractFilter} onValueChange={(v) => setContractFilter(v as "all" | "active" | "none")}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Contrat actif</SelectItem>
              <SelectItem value="none">Sans contrat</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="mb-0.5">
            <X className="w-3.5 h-3.5 mr-1.5" />Réinitialiser
          </Button>
        )}
      </div>

      {isLoading ? (
        view === "list" ? (
          <ListRowsSkeleton rows={6} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="panel space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-6 w-28" />
                <div className="flex items-center justify-between gap-3 border-t pt-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : filtered && filtered.length > 0 ? (
        <Tabs value={view} onValueChange={setView} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {filtered.length} employé{filtered.length !== 1 ? "s" : ""}
            </p>
            <TabsList>
              <TabsTrigger value="cards">Cartes</TabsTrigger>
              <TabsTrigger value="list">Liste</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="cards" className="mt-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {filtered.map((w) => {
            const hasContract = contractWorkerIds?.has(w.id) ?? false;
            const resignedAt = (w as any).date_demission;
            return (
              <Link key={w.id} to={`/workers/${w.id}`} className="block group">
                <div className="h-full panel p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                      {initials(w.full_name)}                      {w.is_department_head && (
                        <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Shield className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight truncate">{w.full_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{w.position || "Fonction non renseignée"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {w.matricule && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">#{w.matricule}</span>}
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{w.department || "Sans département"}</span>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
                    <div>
                      {resignedAt ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <XCircle className="w-3.5 h-3.5" /> Parti le {formatDateFR(resignedAt)}
                        </span>
                      ) : hasContract ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300">
                          <span className="h-2 w-2 rounded-full bg-green-500" /> Contrat actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" /> Sans contrat
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/workers/${w.id}?edit=1`); }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Modifier
                    </Button>
                  </div>
                </div>
              </Link>
            );
              })}
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <SortHeader column="full_name">Employé</SortHeader>
                    <SortHeader column="matricule">Matricule</SortHeader>
                    <SortHeader column="position">Fonction</SortHeader>
                    <SortHeader column="department">Département</SortHeader>
                    <SortHeader column="hire_date">Date d'embauche</SortHeader>
                    <SortHeader column="status">Statut</SortHeader>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWorkers.map((w) => {
                    const hasContract = contractWorkerIds?.has(w.id) ?? false;
                    const resignedAt = (w as any).date_demission;
                    return (
                      <tr key={w.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3 align-middle">
                          <Link to={`/workers/${w.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{initials(w.full_name)}</span>
                            <span>{w.full_name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 align-middle text-muted-foreground">{w.matricule || "—"}</td>
                        <td className="px-4 py-3 align-middle">{w.position || "—"}</td>
                        <td className="px-4 py-3 align-middle">{w.department || "—"}</td>
                        <td className="px-4 py-3 align-middle text-muted-foreground">
                          {(w.hire_date ?? (w as any).date_debut_contrat)
                            ? formatDateFR((w.hire_date ?? (w as any).date_debut_contrat) as string)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {resignedAt ? (
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Démission</span>
                          ) : hasContract ? (
                            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Contrat actif</span>
                          ) : (
                            <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">Sans contrat</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/workers/${w.id}?edit=1`)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Modifier</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <EmptyState
          icon={Users}
          title={search ? "Aucun employé trouvé" : "Aucun employé"}
          description={
            search
              ? "Aucun employé ne correspond à votre recherche."
              : "Créez votre premier employé ou ajustez la recherche."
          }
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Ajouter un employé
            </Button>
          }
        />
      )}
    </div>
  );
}
