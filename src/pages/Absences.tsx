import { DateInput } from "@/components/ui/date-input";
import { formatDateFR } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getWorkers, getAbsences, createAbsence, createAbsencesBulk, updateAbsence, deleteAbsence, type AbsenceWithWorker } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarX, Trash2, Pencil, Filter } from "lucide-react";
import { toast } from "sonner";
import WorkerAutocomplete from "@/components/WorkerAutocomplete";
import WorkerMultiSelect from "@/components/WorkerMultiSelect";
import { OBSERVATION_LIST_CHOICE, OBSERVATION_TYPE_LABEL, OBSERVATION_TYPE_STYLE, findObservation } from "@/data/observations";
import { cn } from "@/lib/utils";

const todayStr = () => new Date().toISOString().slice(0, 10);

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function Absences() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AbsenceWithWorker | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [multiMode, setMultiMode] = useState(false);
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [filterWorker, setFilterWorker] = useState("all");
  const now = new Date();
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));

  const years = useMemo(() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => cy + 1 - i);
  }, []);

  const monthKey = filterMonth === "all" ? undefined : `${filterYear}-${String(Number(filterMonth)).padStart(2, "0")}`;

  const { data: workers } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: absences, isLoading } = useQuery({
    queryKey: ["absences", filterYear, filterMonth],
    queryFn: () => getAbsences(undefined, monthKey),
  });


  const reset = () => {
    setEditing(null); setWorkerId(""); setWorkerIds([]); setMultiMode(false); setDate(todayStr()); setReason("");
  };

  const openCreate = () => { reset(); setOpen(true); };
  const openEdit = (a: AbsenceWithWorker) => {
    setEditing(a); setMultiMode(false); setWorkerId(a.worker_id); setDate(a.absence_date); setReason(a.reason ?? ""); setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateAbsence(editing.id, { absence_date: date, reason: reason.trim() || null });
      }
      if (multiMode) {
        const rows = await createAbsencesBulk({ worker_ids: workerIds, absence_date: date, reason: reason.trim() || undefined });
        return { bulkCount: rows.length };
      }
      return createAbsence({ worker_id: workerId, absence_date: date, reason: reason.trim() || undefined });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["worker-absences"] });
      if (res?.bulkCount) toast.success(`${res.bulkCount} absence(s) enregistrée(s)`);
      else toast.success(editing ? "Absence mise à jour" : "Absence enregistrée");
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteAbsence(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["absences"] });
      qc.invalidateQueries({ queryKey: ["worker-absences"] });
      toast.success("Absence supprimée");
    },
  });

  const handleSubmit = () => {
    if (multiMode && !editing) {
      if (workerIds.length === 0) return toast.error("Sélectionnez au moins un employé");
    } else if (!workerId) return toast.error("Sélectionnez un employé");
    if (!date) return toast.error("Date requise");
    saveMut.mutate();
  };

  const filtered = useMemo(() => {
    if (!absences) return [];
    return absences.filter((a) => {
      if (filterWorker !== "all" && a.worker_id !== filterWorker) return false;
      if (a.absence_date.slice(0, 4) !== filterYear) return false;
      return true;
    });
  }, [absences, filterWorker, filterYear]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Absences</h1>
          <p className="text-muted-foreground mt-1">Gestion des absences journalières</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nouvelle absence</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>{editing ? "Modifier l'absence" : "Nouvelle absence"}</DialogTitle></DialogHeader>
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date *</Label>
                <DateInput value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Motif *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="-- Choisir une observation --" /></SelectTrigger>
                  <SelectContent>
                    {OBSERVATION_LIST_CHOICE.map((o) => (
                      <SelectItem key={o.observation} value={o.observation}>{o.observation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const obs = findObservation(reason);
                  if (!obs) return null;
                  const style = OBSERVATION_TYPE_STYLE[obs.type];
                  return (
                    <div className={cn("mt-2 rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3", style.block)}>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={cn("w-2.5 h-2.5 rounded-full", style.dot)} />
                        <span className="font-semibold">{obs.observation}</span>
                      </div>
                      <span className={cn("text-xs font-bold uppercase tracking-wide rounded-full border px-2.5 py-0.5", style.badge)}>
                        {obs.type} · {OBSERVATION_TYPE_LABEL[obs.type]}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={saveMut.isPending}>{saveMut.isPending ? "..." : "Enregistrer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl p-4 flex flex-wrap items-end gap-3">
        <Filter className="w-4 h-4 text-muted-foreground mb-2.5" />
        <div className="w-[220px]">
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
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Employé</th>
              <th className="p-4 font-medium">Département</th>
              <th className="p-4 font-medium">Motif</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center">
                <CalendarX className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Aucune absence</p>
              </td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-4 text-sm">{formatDateFR(a.absence_date)}</td>
                  <td className="p-4 font-medium">
                    <Link to={`/workers/${a.worker_id}`} className="hover:underline">{a.workers?.full_name ?? "—"}</Link>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{a.workers?.department ?? "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground max-w-[300px] truncate">{a.reason ?? "—"}</td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Supprimer cette absence ?")) delMut.mutate(a.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
