import { DateInput } from "@/components/ui/date-input";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorker, getDocumentsByWorker, updateWorker, deleteWorker, getAcomptes, getAbsences, getConges, congeDuration, CONGE_TYPES, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, FileText, Users, Shield, CheckCircle, Clock, Pencil, Wallet, TrendingUp, TrendingDown, Eye, CalendarX, CalendarRange, Trash2, RefreshCw, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CONTRACT_DURATIONS, computeEndDate, getContractStatus, formatDateFR, durationLabel } from "@/lib/contract-utils";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n);

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewDuration, setRenewDuration] = useState<string>("1_an");

  const { data: worker, isLoading: loadingWorker } = useQuery({
    queryKey: ["worker", id],
    queryFn: () => getWorker(id!),
    enabled: !!id,
  });

  const { data: documents, isLoading: loadingDocs } = useQuery({
    queryKey: ["worker-documents", id],
    queryFn: () => getDocumentsByWorker(id!),
    enabled: !!id,
  });

  const { data: acomptes } = useQuery({
    queryKey: ["worker-acomptes", id],
    queryFn: () => getAcomptes(id!),
    enabled: !!id,
  });

  const { data: absences } = useQuery({
    queryKey: ["worker-absences", id],
    queryFn: () => getAbsences(id!),
    enabled: !!id,
  });

  const { data: conges } = useQuery({
    queryKey: ["worker-conges", id],
    queryFn: () => getConges(id!),
    enabled: !!id,
  });

  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [isDeptHead, setIsDeptHead] = useState(false);

  const openEdit = () => {
    if (!worker) return;
    setEditForm({
      full_name: worker.full_name,
      phone: worker.phone ?? "",
      position: worker.position ?? "",
      department: worker.department ?? "",
      address: worker.address ?? "",
      matricule: worker.matricule ?? "",
      date_naissance: (worker as any).date_naissance ?? "",
      lieu_naissance: (worker as any).lieu_naissance ?? "",
      situation_familiale: (worker as any).situation_familiale ?? "",
      sexe: (worker as any).sexe ?? "",
      hire_date: worker.hire_date ?? "",
      numero_social: (worker as any).numero_social ?? "",
      numero_compte: (worker as any).numero_compte ?? "",
      acte_naissance: (worker as any).acte_naissance ?? "",
      duree_contrat: (worker as any).duree_contrat ?? "",
      date_debut_contrat: (worker as any).date_debut_contrat ?? "",
      date_demission: (worker as any).date_demission ?? "",
    });
    setIsDeptHead(worker.is_department_head ?? false);
    setEditOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("edit") === "1" && worker && !editOpen) {
      openEdit();
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker]);

  const DATE_FIELDS = ["date_naissance", "hire_date", "date_debut_contrat", "date_fin_contrat", "date_demission"];
  const sanitizeDates = (obj: Record<string, any>) => {
    const out: Record<string, any> = { ...obj };
    for (const k of DATE_FIELDS) {
      if (out[k] === "" || out[k] === undefined) out[k] = null;
    }
    return out;
  };

  const editMutation = useMutation({
    mutationFn: () => {
      const payload: any = { ...editForm, is_department_head: isDeptHead };
      // hire_date sert de date de début de contrat
      payload.date_debut_contrat = editForm.hire_date || null;
      if (payload.duree_contrat && editForm.hire_date) {
        payload.date_fin_contrat = computeEndDate(editForm.hire_date, payload.duree_contrat);
      } else {
        payload.date_fin_contrat = null;
      }
      return updateWorker(id!, sanitizeDates(payload));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", id] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      setEditOpen(false);
      toast.success("Employé mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const renewMutation = useMutation({
    mutationFn: () => {
      const start = new Date().toISOString().slice(0, 10);
      const end = computeEndDate(start, renewDuration);
      return updateWorker(id!, { duree_contrat: renewDuration, date_debut_contrat: start, date_fin_contrat: end } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", id] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      setRenewOpen(false);
      toast.success("Contrat renouvelé");
    },
    onError: () => toast.error("Erreur lors du renouvellement"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorker(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Employé supprimé");
      navigate("/workers");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.full_name?.trim()) { toast.error("Le nom est requis"); return; }
    editMutation.mutate();
  };

  if (loadingWorker) return <p className="text-muted-foreground">Chargement...</p>;
  if (!worker) return <p className="text-destructive">Employé introuvable</p>;

  const isBon = (type: string) => type === "bon_sortie" || type === "bon_entree";
  const contractStatus = getContractStatus((worker as any).date_fin_contrat);
  const hasContractDoc = (documents ?? []).some((d: any) => d.document_type === "contract");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/workers"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {worker.full_name}
              {worker.is_department_head && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Chef de service
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[worker.matricule ? `#${worker.matricule}` : null, worker.position, worker.department].filter(Boolean).join(" • ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setRenewOpen(true)}><RefreshCw className="w-4 h-4 mr-2" />Renouveler le contrat</Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Supprimer l'employé</Button>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={openEdit}><Pencil className="w-4 h-4 mr-2" />Modifier</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Modifier l'employé</DialogTitle>
              <DialogDescription>Modifiez les informations de {worker.full_name}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-6 pt-2">
              {/* Information Personnelle */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Information Personnelle</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Matricule</Label>
                    <Input value={editForm.matricule ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, matricule: e.target.value }))} placeholder="Ex: EMP-001" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nom *</Label>
                    <Input value={editForm.full_name ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Nom et prénom" className="h-11" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Adresse</Label>
                    <Input value={editForm.address ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} placeholder="Adresse complète" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date de Naissance</Label>
                    <DateInput value={editForm.date_naissance ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, date_naissance: e.target.value }))} className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Lieu de Naissance</Label>
                    <Input value={editForm.lieu_naissance ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, lieu_naissance: e.target.value }))} placeholder="Ex: Casablanca" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Situation Familiale</Label>
                    <Select value={editForm.situation_familiale ?? ""} onValueChange={(v) => setEditForm((p) => ({ ...p, situation_familiale: v }))}>
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
                    <Select value={editForm.sexe ?? ""} onValueChange={(v) => setEditForm((p) => ({ ...p, sexe: v }))}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculin">Masculin</SelectItem>
                        <SelectItem value="Féminin">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Téléphone</Label>
                    <Input value={editForm.phone ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Ex: 06 12 34 56 78" className="h-11" />
                  </div>
                </div>
              </div>

              {/* Information De Fonction */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Information De Fonction</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Fonction</Label>
                    <Input value={editForm.position ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, position: e.target.value }))} placeholder="Ex: Technicien" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Département</Label>
                    <Input value={editForm.department ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))} placeholder="Ex: Production" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date de Recrutement</Label>
                    <DateInput value={editForm.hire_date ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, hire_date: e.target.value }))} className="h-11" />
                  </div>
                </div>
              </div>

              {/* Numero Identité */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Numéro Identité</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Numéro Social</Label>
                    <Input value={editForm.numero_social ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, numero_social: e.target.value }))} placeholder="0" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Numéro de Compte</Label>
                    <Input value={editForm.numero_compte ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, numero_compte: e.target.value }))} placeholder="0" className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Acte de Naissance</Label>
                    <Input value={editForm.acte_naissance ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, acte_naissance: e.target.value }))} placeholder="Numéro" className="h-11" />
                  </div>
                </div>
              </div>

              {/* Contrat */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Contrat</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Durée</Label>
                    <Select value={editForm.duree_contrat ?? ""} onValueChange={(v) => setEditForm((p) => ({ ...p, duree_contrat: v }))}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {CONTRACT_DURATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date fin (auto)</Label>
                    <DateInput disabled value={(editForm.duree_contrat && editForm.hire_date) ? computeEndDate(editForm.hire_date, editForm.duree_contrat) : ""} className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Date démission</Label>
                    <DateInput value={(editForm as any).date_demission ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, date_demission: e.target.value }))} className="h-11" />
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
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Renew Contract Dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Renouveler le contrat</DialogTitle>
            <DialogDescription>
              Sélectionnez la nouvelle durée. Le contrat débutera aujourd'hui.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Durée</Label>
            <Select value={renewDuration} onValueChange={setRenewDuration}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_DURATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
              Du <span className="font-semibold">{formatDateFR(new Date().toISOString().slice(0,10))}</span>
              {" → "}
              au <span className="font-semibold">{formatDateFR(computeEndDate(new Date().toISOString().slice(0,10), renewDuration))}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Annuler</Button>
            <Button onClick={() => renewMutation.mutate()} disabled={renewMutation.isPending}>
              {renewMutation.isPending ? "..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet employé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet employé ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contract status badge (derived from documents) */}
      <div>
        {hasContractDoc ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-900/40">
            ✅ Actif — Contrat en cours
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-muted text-muted-foreground border">
            <AlertTriangle className="w-4 h-4" /> Pas de contrat
          </span>
        )}
      </div>

      <div className="bg-card border rounded-xl p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          ["Matricule", worker.matricule],
          ["Téléphone", worker.phone],
          ["Adresse", worker.address],
          ["Poste", worker.position],
          ["Département", worker.department],
          ["Date d'embauche", worker.hire_date ? formatDateFR(worker.hire_date) : null],
          ["Date de naissance", (worker as any).date_naissance ? formatDateFR((worker as any).date_naissance) : null],
          ["Lieu de naissance", (worker as any).lieu_naissance],
          ["Situation familiale", (worker as any).situation_familiale],
          ["Sexe", (worker as any).sexe],
          ["N° Social", (worker as any).numero_social],
          ["N° Compte", (worker as any).numero_compte],
          ["Acte de naissance", (worker as any).acte_naissance],
          ["Responsable", worker.is_department_head ? "Oui" : "Non"],
          ["Durée contrat", durationLabel((worker as any).duree_contrat)],
          ["Début contrat", (worker as any).date_debut_contrat ? formatDateFR((worker as any).date_debut_contrat) : null],
          ["Fin contrat", (worker as any).date_fin_contrat ? formatDateFR((worker as any).date_fin_contrat) : null],
          ["Date démission", (worker as any).date_demission ? formatDateFR((worker as any).date_demission) : null],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-xs text-muted-foreground">{label as string}</p>
            <p className="font-medium">{(value as string) || "—"}</p>
          </div>
        ))}
      </div>


      {/* Solde acompte */}
      <div className="bg-card border rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><Wallet className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Solde d'acompte (dette)</p>
            <p className="text-2xl font-bold">{fmt(Number((worker as any).current_balance ?? 0))} DA</p>
          </div>
        </div>
        <Link to="/acomptes"><Button variant="outline" size="sm"><Wallet className="w-4 h-4 mr-2" />Nouvel acompte</Button></Link>
      </div>

      {/* Historique acomptes */}
      {acomptes && acomptes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Historique acomptes ({acomptes.length})</h2>
          <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium text-right">Montant</th>
                  <th className="p-4 font-medium text-right">Avant</th>
                  <th className="p-4 font-medium text-right">Après</th>
                  <th className="p-4 font-medium">Note</th>
                  <th className="p-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {acomptes.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 text-sm">{formatDateFR(t.transaction_date)}</td>
                    <td className="p-4">
                      {t.type === "reglement" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><TrendingDown className="w-3 h-3" />Règlement</span>
                      ) : t.type === "dette" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><TrendingUp className="w-3 h-3" />Dette</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><TrendingUp className="w-3 h-3" />Acompte</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-semibold">{fmt(Number(t.amount))} DA</td>
                    <td className="p-4 text-right text-sm text-muted-foreground">{fmt(Number(t.previous_balance))}</td>
                    <td className="p-4 text-right text-sm font-medium">{fmt(Number(t.new_balance))}</td>
                    <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">{t.note ?? "—"}</td>
                    <td className="p-4 text-right">
                      <Link to={`/acomptes/${t.id}`}><Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Absences */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarX className="w-5 h-5 text-primary" />Absences ({absences?.length ?? 0})</h2>
          <Link to="/absences"><Button variant="outline" size="sm">Gérer</Button></Link>
        </div>
        {absences && absences.length > 0 ? (
          <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Motif</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="p-4 text-sm">{formatDateFR(a.absence_date)}</td>
                    <td className="p-4 text-sm text-muted-foreground">{a.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 bg-card rounded-xl border">
            <p className="text-sm text-muted-foreground">Aucune absence enregistrée</p>
          </div>
        )}
      </div>

      {/* Congés */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarRange className="w-5 h-5 text-primary" />Congés ({conges?.length ?? 0})</h2>
          <Link to="/conges"><Button variant="outline" size="sm">Gérer</Button></Link>
        </div>
        {conges && conges.length > 0 ? (
          <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Du</th>
                  <th className="p-4 font-medium">Au</th>
                  <th className="p-4 font-medium text-right">Durée</th>
                  <th className="p-4 font-medium">Motif</th>
                </tr>
              </thead>
              <tbody>
                {conges.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-4 text-sm font-medium">{CONGE_TYPES[c.conge_type]}</td>
                    <td className="p-4 text-sm">{formatDateFR(c.start_date)}</td>
                    <td className="p-4 text-sm">{formatDateFR(c.end_date)}</td>
                    <td className="p-4 text-sm text-right font-semibold">{congeDuration(c.start_date, c.end_date)} j</td>
                    <td className="p-4 text-sm text-muted-foreground max-w-[250px] truncate">{c.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 bg-card rounded-xl border">
            <p className="text-sm text-muted-foreground">Aucun congé enregistré</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Documents ({documents?.length ?? 0})</h2>
        {loadingDocs ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : documents && documents.length > 0 ? (
          <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Titre</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const bon = isBon(doc.document_type);
                  const respOk = doc.validated_by_responsible;
                  const rhOk = doc.validated_by_rh;
                  return (
                    <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{doc.title}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {DOCUMENT_TYPES[doc.document_type as keyof typeof DOCUMENT_TYPES]?.label}
                        </span>
                      </td>
                      <td className="p-4">
                        {bon ? (
                          respOk && rhOk ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle className="w-3.5 h-3.5" /> Validé</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Clock className="w-3.5 h-3.5" /> En attente</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDateFR(doc.created_at)}
                      </td>
                      <td className="p-4 text-right">
                        <Link to={`/documents/${doc.id}`}>
                          <Button variant="ghost" size="sm">Voir</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-card rounded-xl border">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Aucun document pour cet employé</p>
          </div>
        )}
      </div>
    </div>
  );
}
