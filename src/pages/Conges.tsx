import { DateInput } from "@/components/ui/date-input";
import { formatDateFR } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getWorkers, getConges, createConge, createCongesBulk, updateConge, deleteConge,
  congeDuration, CONGE_TYPES, type CongeType, type CongeWithWorker
} from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarRange, Trash2, Pencil, Filter, FileText } from "lucide-react";
import { generateTitreCongePdf } from "@/lib/titre-conge-pdf";
import { toast } from "sonner";
import WorkerAutocomplete from "@/components/WorkerAutocomplete";
import WorkerMultiSelect from "@/components/WorkerMultiSelect";
import CongesImportExcel from "@/components/CongesImportExcel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const todayStr = () => new Date().toISOString().slice(0, 10);

const TYPE_COLORS: Record<CongeType, string> = {
  annual: "bg-blue-50 text-blue-700",
  sick: "bg-red-50 text-red-700",
  unpaid: "bg-gray-100 text-gray-700",
  maternity: "bg-pink-50 text-pink-700",
  paternity: "bg-indigo-50 text-indigo-700",
  exceptional: "bg-amber-50 text-amber-700",
};

export default function Conges() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CongeWithWorker | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [multiMode, setMultiMode] = useState(false);
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState(todayStr());
  const [type, setType] = useState<CongeType>("annual");
  const [reason, setReason] = useState("");
  const [filterWorker, setFilterWorker] = useState("all");
  const [filterType, setFilterType] = useState<"all" | CongeType>("all");
  const now = new Date();
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));

  const period = useMemo(() => {
    const y = Number(filterYear);
    const from = filterMonth === "all" ? `${y}-01-01` : `${y}-${String(Number(filterMonth)).padStart(2, "0")}-01`;
    const toDate = filterMonth === "all" ? new Date(y + 1, 0, 1) : new Date(y, Number(filterMonth), 1);
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
    return { from, to };
  }, [filterYear, filterMonth]);

  const { data: workers } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: conges, isLoading } = useQuery({
    queryKey: ["conges", filterWorker, filterType, period.from, period.to],
    queryFn: () => getConges(filterWorker, { from: period.from, to: period.to, type: filterType }),
  });



  const reset = () => {
    setEditing(null); setWorkerId(""); setWorkerIds([]); setMultiMode(false);
    setStart(todayStr()); setEnd(todayStr()); setType("annual"); setReason("");
  };

  const openCreate = () => { reset(); setOpen(true); };
  const openEdit = (c: CongeWithWorker) => {
    setEditing(c); setMultiMode(false); setWorkerId(c.worker_id); setStart(c.start_date); setEnd(c.end_date);
    setType(c.conge_type); setReason(c.reason ?? ""); setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateConge(editing.id, { start_date: start, end_date: end, conge_type: type, reason: reason.trim() || null });
      }
      if (multiMode) {
        const res = await createCongesBulk({ worker_ids: workerIds, start_date: start, end_date: end, conge_type: type, reason: reason.trim() || undefined });
        return { bulk: res };
      }
      return createConge({ worker_id: workerId, start_date: start, end_date: end, conge_type: type, reason: reason.trim() || undefined });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["conges"] });
      qc.invalidateQueries({ queryKey: ["worker-conges"] });
      if (res?.bulk) {
        const { success, failed } = res.bulk;
        if (success > 0) toast.success(`${success} congé(s) enregistré(s)`);
        if (failed.length > 0) toast.error(`${failed.length} échec(s) — ${failed[0].message}`);
      } else {
        toast.success(editing ? "Congé mis à jour" : "Congé enregistré");
      }
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteConge(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conges"] });
      qc.invalidateQueries({ queryKey: ["worker-conges"] });
      toast.success("Congé supprimé");
    },
  });

  const handleSubmit = () => {
    if (multiMode && !editing) {
      if (workerIds.length === 0) return toast.error("Sélectionnez au moins un employé");
    } else if (!workerId) return toast.error("Sélectionnez un employé");
    if (!start || !end) return toast.error("Dates requises");
    if (new Date(end) < new Date(start)) return toast.error("La date de fin doit être après la date de début");
    saveMut.mutate();
  };

  const duration = useMemo(() => (start && end && new Date(end) >= new Date(start) ? congeDuration(start, end) : 0), [start, end]);

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    (conges ?? []).forEach((c) => set.add(new Date(c.start_date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [conges]);

  const filtered = useMemo(() => {
    if (!conges) return [];
    const y = Number(filterYear);
    return conges.filter((c) => {
      if (filterWorker !== "all" && c.worker_id !== filterWorker) return false;
      if (filterType !== "all" && c.conge_type !== filterType) return false;
      // period overlap with selected month/year
      const from = filterMonth === "all" ? `${y}-01-01` : `${y}-${String(Number(filterMonth)).padStart(2, "0")}-01`;
      const toDate = filterMonth === "all" ? new Date(y + 1, 0, 1) : new Date(y, Number(filterMonth), 1);
      const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
      if (c.end_date < from) return false;
      if (c.start_date >= to) return false;
      return true;
    });
  }, [conges, filterWorker, filterType, filterYear, filterMonth]);

  // ===== Droit de Congé =====
  const DROIT_FROM = "2026-01-01";
  const DROIT_TO = "2027-01-01";
  const REF_DATE = new Date(2026, 5, 30); // 2026-06-30

  const droitRows = useMemo(() => {
    const list = (workers ?? []).map((w: any) => {
      const enterDate = w.hire_date ?? w.date_debut_contrat ?? null;
      const dayWorked = enterDate
        ? Math.floor((REF_DATE.getTime() - new Date(enterDate).getTime()) / 86400000)
        : 0;
      const mw = dayWorked / 30;
      const monthWorked = mw >= 12 ? 12 : mw < 0 ? 0 : Number(mw.toFixed(1));
      const congeFait = (conges ?? [])
        .filter((c) => c.worker_id === w.id && c.start_date >= DROIT_FROM && c.start_date < DROIT_TO)
        .reduce((s, c) => s + congeDuration(c.start_date, c.end_date), 0);
      const congeDroit = dayWorked < 365 ? Math.max(0, dayWorked) * (30 / 365) : 30;
      return {
        id: w.id,
        matricule: w.matricule ?? "—",
        name: w.full_name ?? "—",
        monthWorked,
        congeFait,
        congeDroit,
        resteConge: congeDroit - congeFait,
        enterDate,
      };
    });
    return list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [workers, conges]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Congés</h1>
          <p className="text-muted-foreground mt-1">Gestion des demandes de congé</p>
        </div>
        <div className="flex items-center gap-2">
        <CongesImportExcel
          workers={workers}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ["conges"] });
            qc.invalidateQueries({ queryKey: ["worker-conges"] });
          }}
        />
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nouveau congé</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader><DialogTitle>{editing ? "Modifier le congé" : "Nouveau congé"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {!editing && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox checked={multiMode} onCheckedChange={(v) => setMultiMode(!!v)} />
                  <span className="font-medium">Sélection multiple (plusieurs employés)</span>
                </label>
              )}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  {multiMode && !editing ? "Employés *" : "Employé *"}
                </Label>
                {multiMode && !editing ? (
                  <WorkerMultiSelect workers={workers} value={workerIds} onChange={setWorkerIds} />
                ) : (
                  <WorkerAutocomplete workers={workers} value={workerId} onChange={setWorkerId} disabled={!!editing} />
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Type *</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONGE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Du *</Label>
                  <DateInput value={start} onChange={(e) => setStart(e.target.value)} className="h-11" />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Au *</Label>
                  <DateInput value={end} onChange={(e) => setEnd(e.target.value)} className="h-11" />
                </div>
              </div>
              {duration > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                  Durée : <span className="font-semibold text-primary">{duration} jour{duration > 1 ? "s" : ""}</span>
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Motif</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison du congé..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={saveMut.isPending}>{saveMut.isPending ? "..." : "Enregistrer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="liste" className="space-y-6">
      <TabsList>
        <TabsTrigger value="liste">Congés</TabsTrigger>
        <TabsTrigger value="droit">Droit de Congé</TabsTrigger>
      </TabsList>

      <TabsContent value="liste" className="space-y-6">
      {/* Filters */}
      <div className="bg-card border rounded-xl p-4 flex flex-wrap items-end gap-3">
        <Filter className="w-4 h-4 text-muted-foreground mb-2.5" />
        <div className="w-[200px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Employé</Label>
          <WorkerAutocomplete
            workers={workers}
            value={filterWorker}
            onChange={setFilterWorker}
            includeAll
            allLabel="Tous"
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {Object.entries(CONGE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Année</Label>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Mois</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les mois</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          Total : <span className="font-semibold text-foreground">{filtered.length}</span>
        </div>
      </div>

      {/* List */}
      <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
              <th className="p-4 font-medium">Employé</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Du</th>
              <th className="p-4 font-medium">Au</th>
              <th className="p-4 font-medium text-right">Durée</th>
              <th className="p-4 font-medium">Motif</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-10 text-center">
                <CalendarRange className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Aucun congé</p>
              </td></tr>
            ) : (
              filtered.map((c) => {
                const dur = congeDuration(c.start_date, c.end_date);
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 font-medium">
                      <Link to={`/workers/${c.worker_id}`} className="hover:underline">{c.workers?.full_name ?? "—"}</Link>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[c.conge_type]}`}>
                        {CONGE_TYPES[c.conge_type]}
                      </span>
                    </td>
                    <td className="p-4 text-sm">{formatDateFR(c.start_date)}</td>
                    <td className="p-4 text-sm">{formatDateFR(c.end_date)}</td>
                    <td className="p-4 text-right font-semibold">{dur} j</td>
                    <td className="p-4 text-sm text-muted-foreground max-w-[250px] truncate">{c.reason ?? "—"}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" title="Titre de congé (PDF)" onClick={() => generateTitreCongePdf(c)}><FileText className="w-4 h-4 text-primary" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Supprimer ce congé ?")) delMut.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </TabsContent>

      <TabsContent value="droit" className="space-y-6">
        <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                <th className="p-4 font-medium">MATRICULE</th>
                <th className="p-4 font-medium">Employée</th>
                <th className="p-4 font-medium text-right">Month Worked</th>
                <th className="p-4 font-medium text-right">Congé Fait</th>
                <th className="p-4 font-medium text-right">Droit Congé</th>
                <th className="p-4 font-medium text-right">Reste Congé</th>
                <th className="p-4 font-medium">Date Entrée</th>
              </tr>
            </thead>
            <tbody>
              {droitRows.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center">
                  <CalendarRange className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">Aucune donnée</p>
                </td></tr>
              ) : (
                droitRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 text-sm">{r.matricule}</td>
                    <td className="p-4 font-medium">
                      <Link to={`/workers/${r.id}`} className="hover:underline">{r.name}</Link>
                    </td>
                    <td className="p-4 text-right text-sm">{r.monthWorked}</td>
                    <td className="p-4 text-right text-sm">{r.congeFait}</td>
                    <td className="p-4 text-right font-semibold">{r.congeDroit.toFixed(1)}</td>
                    <td className={`p-4 text-right font-semibold ${r.resteConge < 0 ? "text-destructive" : ""}`}>{r.resteConge.toFixed(1)}</td>
                    <td className="p-4 text-sm">{r.enterDate ? formatDateFR(r.enterDate) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TabsContent>
      </Tabs>
    </div>

  );
}
