import { DateInput } from "@/components/ui/date-input";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkers, createWorker, getWorkerIdsWithContract, type WorkerInsert } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, Search, Shield, Upload, Pencil, AlertTriangle, XCircle, Building2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import ImportWorkersDialog from "@/components/ImportWorkersDialog";
import { CONTRACT_DURATIONS, computeEndDate, getContractStatus, formatDateFR } from "@/lib/contract-utils";
import { useAuth } from "@/contexts/AuthContext";

const emptyWorker: WorkerInsert = {
  full_name: "", phone: "", position: "", department: "", address: "", matricule: "",
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

type SortKey = "full_name" | "matricule" | "position" | "department" | "status";

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
  const [view, setView] = useState("cards");
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [importOpen, setImportOpen] = useState(false);
  const { data: workers, isLoading } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: contractWorkerIds } = useQuery({ queryKey: ["workers-with-contract"], queryFn: getWorkerIdsWithContract });

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
    return matchesSearch && matchesStatus;
  });

  const sortedWorkers = [...(filtered ?? [])].sort((a, b) => {
    const statusValue = (worker: typeof a) => {
      if ((worker as any).date_demission) return "3-démission";
      return contractWorkerIds?.has(worker.id) ? "1-contrat actif" : "2-sans contrat";
    };
    const value = (worker: typeof a) => sortKey === "status"
      ? statusValue(worker)
      : String(worker[sortKey] ?? "");
    const comparison = value(a).localeCompare(value(b), "fr", { sensitivity: "base" });
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const SortHeader = ({ column, children, className = "" }: { column: SortKey; children: React.ReactNode; className?: string }) => {
    const active = sortKey === column;
    const Icon = !active ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={`px-4 py-3 font-medium ${className}`} aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
          {children} <Icon className="h-3.5 w-3.5" />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">Employés</h1>
            {!isGlobal && role && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <Building2 className="w-3.5 h-3.5" /> Département : {role}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {isGlobal ? "Gérez vos employés" : "Employés de votre département"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />Importer Excel
          </Button>
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
                    <Input value={form.department ?? ""} onChange={(e) => updateField("department", e.target.value)} placeholder="Ex: Production" className="h-11" />
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
        </div>
      </div>

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

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
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
                <div className="h-full rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-11 w-11 sh
rink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
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
                    {w.matricule && <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">#{w.matricule}</span>}
                    <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{w.department || "Sans département"}</span>
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
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <SortHeader column="full_name" className="px-5">Employé</SortHeader>
                    <SortHeader column="matricule">Matricule</SortHeader>
                    <SortHeader column="position">Fonction</SortHeader>
                    <SortHeader column="department">Département</SortHeader>
                    <SortHeader column="status">Statut</SortHeader>
                    <th className="px-5 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedWorkers.map((w) => {
                    const hasContract = contractWorkerIds?.has(w.id) ?? false;
                    const resignedAt = (w as any).date_demission;
                    return (
                      <tr key={w.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link to={`/workers/${w.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{initials(w.full_name)}</span>
                            <span>{w.full_name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{w.matricule || "—"}</td>
                        <td className="px-4 py-3">{w.position || "—"}</td>
                        <td className="px-4 py-3">{w.department || "—"}</td>
                        <td className="px-4 py-3">
                          {resignedAt ? <span className="text-xs text-muted-foreground">Démission</span> : hasContract ? <span className="text-xs font-medium text-green-700 dark:text-green-300">Contrat actif</span> : <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Sans contrat</span>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/workers/${w.id}?edit=1`)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Modifier</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {search ? "Aucun employé trouvé" : "Aucun employé. Ajoutez votre premier employé."}
          </p>
        </div>
      )}
    </div>
  );
}
