import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getWorkers,
  getAcomptes,
  createAcompte,
  deleteAcompte,
  createWorker,
  deleteWorker,
  refreshWorkerBalance,
  type Worker,
  type AcompteTransaction,
} from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { formatDateFR } from "@/lib/date-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import {
  Plus,
  Users,
  Search,
  BarChart3,
  Settings,
  Save,
  FileText,
  Receipt,
  Eye,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Printer,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0);
const todayStr = () => new Date().toISOString().slice(0, 10);

const TYPE_BADGE: Record<string, string> = {
  acompte: "bg-warning/15 text-warning",
  dette: "bg-destructive/10 text-destructive",
  reglement: "bg-success/10 text-success",
};
const TYPE_LABEL: Record<string, string> = {
  acompte: "ACOMPTE",
  dette: "DETTE",
  reglement: "REGLEMENT",
};

type WorkerExt = Worker & { current_balance?: number; monthly_retention?: number };

// ====================== TOTALS COMPUTATION ======================
function useWorkerStats(workers: WorkerExt[] | undefined, txs: AcompteTransaction[] | undefined) {
  return useMemo(() => {
    const map = new Map<string, { acompte: number; dette: number; reglement: number }>();
    (workers || []).forEach((w) => map.set(w.id, { acompte: 0, dette: 0, reglement: 0 }));
    (txs || []).forEach((t) => {
      const s = map.get(t.worker_id);
      if (!s) return;
      const a = Number(t.amount) || 0;
      if (t.type === "acompte") s.acompte += a;
      else if (t.type === "dette") s.dette += a;
      else if (t.type === "reglement") s.reglement += a;
    });
    return map;
  }, [workers, txs]);
}

export default function Acomptes() {
  const qc = useQueryClient();
  const { data: workers } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: txs } = useQuery({ queryKey: ["acomptes"], queryFn: () => getAcomptes() });
  const stats = useWorkerStats(workers as WorkerExt[], txs);

  const totals = useMemo(() => {
    let acompte = 0, dette = 0, reglement = 0;
    (txs || []).forEach((t) => {
      const a = Number(t.amount) || 0;
      if (t.type === "acompte") acompte += a;
      else if (t.type === "dette") dette += a;
      else if (t.type === "reglement") reglement += a;
    });
    return { acompte, dette, reglement, reste: acompte + dette - reglement };
  }, [txs]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="ERCM SA — Gestion des Acomptes et Dettes"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {workers?.length ?? 0} Employés enregistrés
        </span>
      </PageHeader>

      <Tabs defaultValue="nouvelle" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto bg-transparent border-b rounded-none p-0 gap-0">
          <TabsTrigger value="nouvelle" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none py-3 gap-2">
            <Plus className="w-4 h-4" /> Nouvelle Opération
          </TabsTrigger>
          <TabsTrigger value="groupees" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none py-3 gap-2">
            <Users className="w-4 h-4" /> Opérations Groupées
          </TabsTrigger>
          <TabsTrigger value="historique" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none py-3 gap-2">
            <Search className="w-4 h-4" /> Historique & Filtres
          </TabsTrigger>
          <TabsTrigger value="bilan" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none py-3 gap-2">
            <BarChart3 className="w-4 h-4" /> Bilan Général
          </TabsTrigger>
          <TabsTrigger value="employes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none py-3 gap-2">
            <Settings className="w-4 h-4" /> Gestion Employés
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nouvelle" className="mt-6">
          <NouvelleOperation workers={(workers || []) as WorkerExt[]} />
        </TabsContent>
        <TabsContent value="groupees" className="mt-6">
          <OperationsGroupees workers={(workers || []) as WorkerExt[]} stats={stats} />
        </TabsContent>
        <TabsContent value="historique" className="mt-6">
          <Historique txs={txs || []} />
        </TabsContent>
        <TabsContent value="bilan" className="mt-6">
          <BilanGeneral workers={(workers || []) as WorkerExt[]} stats={stats} totals={totals} />
        </TabsContent>
        <TabsContent value="employes" className="mt-6">
          <GestionEmployes workers={(workers || []) as WorkerExt[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ====================== NOUVELLE OPÉRATION ======================
function NouvelleOperation({ workers }: { workers: WorkerExt[] }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<"acompte" | "dette" | "reglement">("acompte");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    return workers
      .filter((w) => w.full_name.toLowerCase().includes(s) || (w.matricule || "").toLowerCase().includes(s))
      .slice(0, 8);
  }, [search, workers]);

  const reset = () => {
    setSearch(""); setWorkerId(""); setAmount(""); setNote("");
    setType("acompte"); setDate(todayStr());
  };

  const save = async (after: "none" | "recu" | "decharge") => {
    if (!workerId) return toast.error("Sélectionnez un employé");
    const a = parseFloat(amount);
    if (!a || a <= 0) return toast.error("Montant invalide");
    try {
      const tx = await createAcompte({ worker_id: workerId, type, amount: a, transaction_date: date, note: note.trim() || undefined });
      toast.success("Opération enregistrée");
      qc.invalidateQueries({ queryKey: ["acomptes"] });
      qc.invalidateQueries({ queryKey: ["workers"] });
      if (after !== "none") {
        // Open print preview
        window.open(`/acomptes/${tx.id}?print=1&variant=${after}`, "_blank");
      }
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  return (
    <div className="panel p-6">
      <h2 className="text-primary font-bold mb-5 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Saisir une transaction (Individuelle)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="relative">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
            Nom de l'employé *
          </Label>
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setWorkerId(""); }}
            placeholder="Tapez le nom..."
            className="h-11"
          />
          {suggestions.length > 0 && !workerId && (
            <div className="absolute z-10 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
              {suggestions.map((w) => (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => { setWorkerId(w.id); setSearch(`${w.full_name}${w.matricule ? ` (#${w.matricule})` : ""}`); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                >
                  <span className="font-medium">{w.full_name}</span>
                  {w.matricule && <span className="text-muted-foreground"> · #{w.matricule}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date *</Label>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Type d'opération *</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="-- Choisir --" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="acompte">Acompte (avance)</SelectItem>
              <SelectItem value="dette">Dette</SelectItem>
              <SelectItem value="reglement">Règlement (remboursement)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Montant (DA) *</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11" placeholder="0.00" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description (optionnel)</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes (ex: Avance Aïd, Retenue mois de Mars...)" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        <Button onClick={() => save("none")}>
          <Save className="w-4 h-4 mr-2" /> Enregistrer seulement
        </Button>
        <Button onClick={() => save("recu")} variant="success">
          <Receipt className="w-4 h-4 mr-2" /> Enregistrer & Reçu
        </Button>
        <Button onClick={() => save("decharge")} variant="info">
          <FileText className="w-4 h-4 mr-2" /> Enregistrer & Décharge
        </Button>
      </div>
    </div>
  );
}

// ====================== OPÉRATIONS GROUPÉES ======================
function OperationsGroupees({
  workers,
  stats,
}: {
  workers: WorkerExt[];
  stats: Map<string, { acompte: number; dette: number; reglement: number }>;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState("");
  const [retentionInputs, setRetentionInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const s = search.toLowerCase();
    return [...workers]
      .filter((w) => !s || w.full_name.toLowerCase().includes(s) || (w.matricule || "").toLowerCase().includes(s))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [workers, search]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const allOn = () => setSelected(new Set(list.map((w) => w.id)));
  const allOff = () => setSelected(new Set());

  const saveRetention = async (workerId: string) => {
    const v = parseFloat(retentionInputs[workerId] || "0");
    if (isNaN(v) || v < 0) return toast.error("Montant invalide");
    const { error } = await supabase.from("workers").update({ monthly_retention: v } as any).eq("id", workerId);
    if (error) return toast.error(error.message);
    toast.success("Retenue mise à jour");
    qc.invalidateQueries({ queryKey: ["workers"] });
    setRetentionInputs((p) => ({ ...p, [workerId]: "" }));
  };

  const appliquerRetenues = async () => {
    if (selected.size === 0) return toast.error("Sélectionnez au moins un employé");
    setBusy(true);
    let ok = 0, skip = 0;
    for (const id of selected) {
      const w = workers.find((x) => x.id === id);
      const r = Number(w?.monthly_retention || 0);
      if (!r) { skip++; continue; }
      try {
        await createAcompte({ worker_id: id, type: "reglement", amount: r, transaction_date: date, note: "Retenue mensuelle automatique" });
        ok++;
      } catch { skip++; }
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["acomptes"] });
    qc.invalidateQueries({ queryKey: ["workers"] });
    toast.success(`${ok} retenue(s) appliquée(s)${skip ? `, ${skip} ignorée(s)` : ""}`);
    setSelected(new Set());
  };

  const solderAcomptes = async () => {
    if (selected.size === 0) return toast.error("Sélectionnez au moins un employé");
    if (!confirm(`Solder les acomptes pour ${selected.size} employé(s) ?`)) return;
    setBusy(true);
    let ok = 0, skip = 0;
    for (const id of selected) {
      const s = stats.get(id);
      const reste = s ? s.acompte - s.reglement : 0;
      if (reste <= 0) { skip++; continue; }
      try {
        await createAcompte({ worker_id: id, type: "reglement", amount: reste, transaction_date: date, note: "Solde Acompte Auto" });
        ok++;
      } catch { skip++; }
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["acomptes"] });
    qc.invalidateQueries({ queryKey: ["workers"] });
    toast.success(`${ok} acompte(s) soldé(s)${skip ? `, ${skip} ignoré(s)` : ""}`);
    setSelected(new Set());
  };

  return (
    <div className="panel p-6 space-y-4">
      <h2 className="text-primary font-bold flex items-center gap-2">
        <Users className="w-4 h-4" /> Traitements en Masse
      </h2>
      <p className="text-sm text-muted-foreground">Cochez les employés puis appliquez l'action.</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={allOn} variant="info">
          <Check className="w-3.5 h-3.5 mr-1" /> Tout cocher
        </Button>
        <Button size="sm" onClick={allOff} variant="outline">
          <X className="w-3.5 h-3.5 mr-1" /> Tout décocher
        </Button>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="h-9 max-w-xs"
        />
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/40">
              <tr>
                <th className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sel.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employé</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reste Acompte</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solde Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Retenue Config.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configurer</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => {
                const s = stats.get(w.id) || { acompte: 0, dette: 0, reglement: 0 };
                const resteAc = Math.max(0, s.acompte - s.reglement);
                const solde = s.acompte + s.dette - s.reglement;
                const ret = Number(w.monthly_retention || 0);
                return (
                  <tr key={w.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 align-middle">
                      <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                    </td>
                    <td className="px-4 py-3 align-middle font-semibold">{w.full_name}{w.matricule ? <span className="text-muted-foreground font-normal"> · #{w.matricule}</span> : null}</td>
                    <td className="px-4 py-3 align-middle text-right font-semibold text-warning">{fmt(resteAc)}</td>
                    <td className="px-4 py-3 align-middle text-right font-semibold text-destructive">{fmt(solde)}</td>
                    <td className="px-4 py-3 align-middle text-right text-muted-foreground">{ret > 0 ? `${fmt(ret)} /mois` : "—"}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="DA"
                          className="h-8 w-24"
                          value={retentionInputs[w.id] ?? ""}
                          onChange={(e) => setRetentionInputs((p) => ({ ...p, [w.id]: e.target.value }))}
                        />
                        <Button size="sm" variant="info" className="h-8" onClick={() => saveRetention(w.id)}>OK</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
        <p className="font-semibold mb-3">Actions à appliquer :</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-44" />
          </div>
          <Button onClick={appliquerRetenues} disabled={busy} variant="success">
            <Check className="w-4 h-4 mr-2" /> Appliquer Retenues
          </Button>
          <Button onClick={solderAcomptes} disabled={busy} variant="warning">
            <Receipt className="w-4 h-4 mr-2" /> Solder Acomptes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ====================== HISTORIQUE ======================
function Historique({ txs }: { txs: (AcompteTransaction & { workers?: any })[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<"all" | "acompte" | "dette" | "reglement">("all");

  const filtered = useMemo(() => {
    const n = name.toLowerCase();
    return txs.filter((t) => {
      if (n && !(t.workers?.full_name || "").toLowerCase().includes(n)) return false;
      if (from && t.transaction_date < from) return false;
      if (to && t.transaction_date > to) return false;
      if (type !== "all" && t.type !== type) return false;
      return true;
    });
  }, [txs, name, from, to, type]);

  const del = async (id: string) => {
    if (!confirm("Supprimer cette opération ?")) return;
    await deleteAcompte(id);
    qc.invalidateQueries({ queryKey: ["acomptes"] });
    qc.invalidateQueries({ queryKey: ["workers"] });
    toast.success("Supprimée");
  };

  return (
    <div className="panel p-6 space-y-4">
      <h2 className="text-primary font-bold flex items-center gap-2">
        <Search className="w-4 h-4" /> Filtrer l'Historique
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Nom</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chercher..." className="h-10" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Du</Label>
          <DateInput value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Au</Label>
          <DateInput value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="acompte">Acompte</SelectItem>
              <SelectItem value="dette">Dette</SelectItem>
              <SelectItem value="reglement">Règlement</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { setName(""); setFrom(""); setTo(""); setType("all"); }}>
          <X className="w-4 h-4 mr-2" /> Effacer Filtres
        </Button>
        <Button onClick={() => window.print()} variant="info">
          <Printer className="w-4 h-4 mr-2" /> Imprimer
        </Button>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant (DA)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Aucune opération</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 align-middle">{formatDateFR(t.transaction_date)}</td>
                  <td className="px-4 py-3 align-middle font-semibold">{t.workers?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 align-middle">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_BADGE[t.type] || "bg-muted text-muted-foreground"}`}>
                      {TYPE_LABEL[t.type] || t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-right font-semibold">{fmt(Number(t.amount))}</td>
                  <td className="px-4 py-3 align-middle text-muted-foreground max-w-md truncate">{t.note || "-"}</td>
                  <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                    <Link to={`/acomptes/${t.id}`}>
                      <Button variant="info" size="icon-sm"><Eye className="w-3.5 h-3.5" /></Button>
                    </Link>
                    <Button variant="destructive" size="icon-sm" onClick={() => del(t.id)} className="ml-1"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ====================== BILAN GÉNÉRAL ======================
function BilanGeneral({
  workers,
  stats,
  totals,
}: {
  workers: WorkerExt[];
  stats: Map<string, { acompte: number; dette: number; reglement: number }>;
  totals: { acompte: number; dette: number; reglement: number; reste: number };
}) {
  const qc = useQueryClient();

  const rows = useMemo(() => {
    return [...workers]
      .map((w) => {
        const s = stats.get(w.id) || { acompte: 0, dette: 0, reglement: 0 };
        return { w, ...s, reste: s.acompte + s.dette - s.reglement };
      })
      .sort((a, b) => a.w.full_name.localeCompare(b.w.full_name));
  }, [workers, stats]);

  const exportJson = () => {
    const data = {
      exported_at: new Date().toISOString(),
      workers: workers.map((w) => ({
        id: w.id,
        matricule: w.matricule,
        full_name: w.full_name,
        position: w.position,
        monthly_retention: Number(w.monthly_retention || 0),
      })),
      stats: rows.map((r) => ({
        matricule: r.w.matricule,
        full_name: r.w.full_name,
        total_acomptes: r.acompte,
        total_dettes: r.dette,
        total_reglements: r.reglement,
        reste_a_payer: r.reste,
      })),
      totals,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bilan_acomptes_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Bilan exporté");
  };

  const importJson = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        const empArr: any[] = Array.isArray(data)
          ? data
          : data.employes || data.employees || data.workers || [];
        const txArr: any[] = data.transactions || [];
        const retMap: Record<string, number> = data.monthlyRetainments || data.monthly_retainments || {};

        const norm = (s: any) => String(s ?? "").trim().toLowerCase();
        const normMat = (s: any) => {
          const v = String(s ?? "").trim();
          if (!v || ["n/a", "na", "-"].includes(v.toLowerCase())) return "";
          return v;
        };

        const current = [...workers];
        const findWorker = (mat: string, name: string) => {
          const m = normMat(mat);
          const n = norm(name);
          return current.find((w) => {
            const wm = normMat(w.matricule);
            if (m && wm && (wm === m || wm.replace(/^0+/, "") === m.replace(/^0+/, ""))) return true;
            if (!m && norm(w.full_name) === n) return true;
            return false;
          });
        };

        let addedEmp = 0;
        for (const row of empArr) {
          const matricule = row.matricule || null;
          const full_name = row.full_name || row.nom;
          if (!full_name) continue;
          if (findWorker(matricule, full_name)) continue;
          const created = await createWorker({
            full_name,
            matricule,
            position: row.position || row.poste || null,
            monthly_retention: Number(retMap[full_name] || row.monthly_retention || 0),
          } as any);
          if (created) current.push(created as any);
          addedEmp++;
        }

        // Apply monthly retainments to existing workers
        for (const [name, val] of Object.entries(retMap)) {
          const w = findWorker("", name);
          if (w && Number(w.monthly_retention || 0) !== Number(val)) {
            await (supabase as any).from("workers").update({ monthly_retention: Number(val) || 0 }).eq("id", w.id);
          }
        }

        const TYPE_MAP: Record<string, string> = {
          ACOMPTE: "acompte", DETTE: "dette", REGLEMENT: "reglement",
          acompte: "acompte", dette: "dette", reglement: "reglement",
          add: "acompte", subtract: "reglement",
        };

        let addedTx = 0, skippedTx = 0;
        for (const t of txArr) {
          const w = findWorker(t.matricule, t.nomPrenom || t.full_name || t.nom || "");
          if (!w) { skippedTx++; continue; }
          const type = TYPE_MAP[t.type] || "acompte";
          const amount = Number(t.montant ?? t.amount ?? 0);
          if (!amount) { skippedTx++; continue; }
          const date = (t.date || t.transaction_date || todayStr()).slice(0, 10);
          const { error } = await (supabase as any).from("acompte_transactions").insert({
            worker_id: w.id,
            type,
            amount,
            transaction_date: date,
            note: t.description || t.note || null,
          });
          if (error) { skippedTx++; continue; }
          addedTx++;
        }

        // Refresh balances for impacted workers
        const impacted = new Set<string>();
        for (const t of txArr) {
          const w = findWorker(t.matricule, t.nomPrenom || t.full_name || t.nom || "");
          if (w) impacted.add(w.id);
        }
        for (const id of impacted) await refreshWorkerBalance(id);

        qc.invalidateQueries({ queryKey: ["workers"] });
        qc.invalidateQueries({ queryKey: ["acomptes"] });
        const parts: string[] = [];
        if (addedEmp) parts.push(`${addedEmp} employé(s)`);
        if (addedTx) parts.push(`${addedTx} opération(s)`);
        if (skippedTx) parts.push(`${skippedTx} ignorée(s)`);
        toast.success(parts.length ? `Importé: ${parts.join(", ")}` : "Aucune donnée à importer");
      } catch (e: any) {
        toast.error(e?.message || "JSON invalide");
      }
    };
    inp.click();
  };

  const remiseAZero = async () => {
    if (!confirm("⚠️ Supprimer TOUTES les opérations (acomptes, dettes, règlements) ? Cette action est irréversible.")) return;
    if (!confirm("Confirmer la remise à zéro complète ?")) return;
    const { error } = await (supabase as any).from("acompte_transactions").delete().not("id", "is", null);
    if (error) return toast.error(error.message);
    for (const w of workers) await refreshWorkerBalance(w.id);
    qc.invalidateQueries({ queryKey: ["acomptes"] });
    qc.invalidateQueries({ queryKey: ["workers"] });
    toast.success("Remise à zéro effectuée");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-primary font-bold flex items-center gap-2">
        <BarChart3 className="w-4 h-4" /> Bilan Général
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card title="Total Acomptes" value={fmt(totals.acompte)} dot="bg-warning" />
        <Card title="Total Dettes" value={fmt(totals.dette)} dot="bg-destructive" />
        <Card title="Total Règlements" value={fmt(totals.reglement)} dot="bg-success" />
        <Card title="Reste à Recouvrer" value={fmt(totals.reste)} dot="bg-info" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={exportJson} variant="success"><Download className="w-4 h-4 mr-2" />Exporter (JSON)</Button>
        <Button onClick={importJson} variant="info"><Upload className="w-4 h-4 mr-2" />Importer (JSON)</Button>
        <Button onClick={remiseAZero} variant="destructive"><RotateCcw className="w-4 h-4 mr-2" />Remise à Zéro</Button>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matricule</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employé</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Acomptes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Dettes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Règlements</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reste à Payer</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const solde = r.reste <= 0;
                return (
                  <tr key={r.w.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 align-middle text-muted-foreground">{r.w.matricule || "—"}</td>
                    <td className="px-4 py-3 align-middle font-bold">{r.w.full_name}</td>
                    <td className="px-4 py-3 align-middle text-right">{fmt(r.acompte)}</td>
                    <td className="px-4 py-3 align-middle text-right">{fmt(r.dette)}</td>
                    <td className="px-4 py-3 align-middle text-right text-success">{fmt(r.reglement)}</td>
                    <td className={`px-4 py-3 align-middle text-right font-semibold ${solde ? "text-success" : "text-destructive"}`}>{fmt(Math.max(0, r.reste))}</td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${solde ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {solde ? "SOLDÉ" : "NON RÉGLÉ"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, dot }: { title: string; value: string; dot: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <p className="mt-3 text-2xl md:text-3xl font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

// ====================== GESTION EMPLOYÉS ======================
function GestionEmployes({ workers }: { workers: WorkerExt[] }) {
  const qc = useQueryClient();
  const [matricule, setMatricule] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [search, setSearch] = useState("");

  const list = useMemo(() => {
    const s = search.toLowerCase();
    return [...workers]
      .filter((w) => !s || w.full_name.toLowerCase().includes(s) || (w.matricule || "").toLowerCase().includes(s) || (w.position || "").toLowerCase().includes(s))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [workers, search]);

  const add = useMutation({
    mutationFn: () => createWorker({ full_name: fullName.trim(), matricule: matricule.trim() || null, position: position.trim() || null } as any),
    onSuccess: () => {
      toast.success("Employé ajouté");
      setMatricule(""); setFullName(""); setPosition("");
      qc.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteWorker(id),
    onSuccess: () => {
      toast.success("Employé supprimé");
      qc.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <h3 className="text-primary font-bold flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4" /> Ajouter un employé
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} className="h-11" />
          <Input placeholder="Nom et Prénom" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
          <Input placeholder="Poste" value={position} onChange={(e) => setPosition(e.target.value)} className="h-11" />
          <Button onClick={() => fullName.trim() ? add.mutate() : toast.error("Nom requis")} className="h-11">Ajouter</Button>
        </div>
      </div>

      <div className="panel p-6 space-y-3">
        <h3 className="text-primary font-bold flex items-center gap-2">
          <Users className="w-4 h-4" /> Liste des employés ({workers.length})
        </h3>
        <Input placeholder="Rechercher un employé..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10" />

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matricule</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom et Prénom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Poste</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 align-middle text-muted-foreground">{w.matricule || "—"}</td>
                    <td className="px-4 py-3 align-middle font-bold">{w.full_name}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground uppercase">{w.position || "—"}</td>
                    <td className="px-4 py-3 align-middle text-right">
                      <Button size="sm" variant="destructive" className="h-8" onClick={() => { if (confirm(`Supprimer ${w.full_name} ?`)) del.mutate(w.id); }}>X</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
