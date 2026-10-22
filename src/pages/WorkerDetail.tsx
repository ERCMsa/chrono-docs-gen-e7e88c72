import { DateInput } from "@/components/ui/date-input";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorker, getDocumentsByWorker, updateWorker, deleteWorker, getAcomptes, getAbsences, getConges, congeDuration, congeDurationExcludingWeekend, CONGE_TYPES, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { useAuth } from "@/contexts/AuthContext";
import Forbidden from "@/pages/Forbidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, FileText, Users, Shield, CheckCircle, Clock, Pencil, Wallet, TrendingUp, TrendingDown, Eye, CalendarX, CalendarRange, Trash2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import RenewContractButton from "@/components/RenewContractButton";
import { ListRowsSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONTRACT_DURATIONS, computeEndDate, getContractStatus, formatDateFR, durationLabel } from "@/lib/contract-utils";
import { DEPARTMENTS } from "@/lib/departments";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n);

const initials = (name?: string | null) =>
  (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Date ISO ("YYYY-MM-DD") -> minuit LOCAL. */
function parseLocalIso(iso?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Ancienneté formatée à partir de la date d'embauche.
 * Les deux bornes sont comparées en minuit local : mélanger new Date("YYYY-MM-DD")
 * (lu en UTC) avec une date locale décalerait le calcul d'un jour.
 */
function formatAnciennete(hireDate?: string | null, today: Date = new Date()): string {
  const start = parseLocalIso(hireDate);
  if (!start) return "—";
  let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) months -= 1;
  if (months < 0) return "—"; // embauche dans le futur : donnée incohérente
  if (months === 0) return "moins d'un mois";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearLabel = years > 1 ? `${years} ans` : `${years} an`;
  if (years === 0) return `${rest} mois`;
  return rest === 0 ? yearLabel : `${yearLabel} ${rest} mois`;
}

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tab, setTab] = useState("apercu");
  const { role, can, canAccessDepartment, canDocument } = useAuth();
  const canManageContracts = role === "ADMIN" || role === "RH";

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

  // Dernier contrat de l'employé (documents triés par created_at desc)
  const latestContract = (documents ?? []).find((d: any) => d.document_type === "contract");

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

  if (loadingWorker) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <div className="panel space-y-4 p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!worker) return <p className="text-destructive">Employé introuvable</p>;

  // Portée : un employé hors des départements de l'utilisateur est inaccessible
  if (!canAccessDepartment(worker.department)) {
    return <Forbidden message="Cet employé n'appartient pas à vos départements." />;
  }

  const isBon = (type: string) => type === "bon_sortie" || type === "bon_entree";
  const contractStatus = getContractStatus((worker as any).date_fin_contrat);
  const hasContractDoc = (documents ?? []).some((d: any) => d.document_type === "contract");
  const resignedAt = (worker as any).date_demission as string | null;
  // Onglet Documents : seuls les types autorisés (doc_*) sont visibles
  const visibleDocuments = (documents ?? []).filter(
    (d: any) => canDocument(d.document_type, "view"),
  );

  // Indicateurs de l'aperçu
  const anciennete = formatAnciennete(worker.hire_date);
  const solde = Number((worker as any).current_balance ?? 0);
  const congeJours = (conges ?? []).reduce((s, c) => s + congeDuration(c.start_date, c.end_date), 0);
  const congeJoursHorsWeekend = (conges ?? []).reduce(
    (s, c) => s + congeDurationExcludingWeekend(c.start_date, c.end_date),
    0,
  );
  const nbAbsences = absences?.length ?? 0;

  // Regroupement des 18 champs d'information (aucun champ perdu)
  type InfoField = { label: string; value: string | null; wide?: boolean; tone?: "destructive"; chip?: React.ReactNode };
  const infoGroups: Array<{ title: string; fields: InfoField[] }> = [
    {
      title: "Identité",
      fields: [
        { label: "Matricule", value: worker.matricule },
        { label: "Date de naissance", value: (worker as any).date_naissance ? formatDateFR((worker as any).date_naissance) : null },
        { label: "Lieu de naissance", value: (worker as any).lieu_naissance },
        { label: "Situation familiale", value: (worker as any).situation_familiale },
        { label: "Sexe", value: (worker as any).sexe },
        { label: "N° acte de naissance", value: (worker as any).acte_naissance },
      ],
    },
    {
      title: "Coordonnées",
      fields: [
        { label: "Téléphone", value: worker.phone },
        { label: "Adresse", value: worker.address, wide: true },
      ],
    },
    {
      title: "Fonction",
      fields: [
        { label: "Poste", value: worker.position },
        { label: "Département", value: worker.department },
        { label: "Responsable de département", value: worker.is_department_head ? "Oui" : "Non" },
        { label: "Date d'embauche", value: worker.hire_date ? formatDateFR(worker.hire_date) : null },
      ],
    },
    {
      title: "Contrat",
      fields: [
        { label: "N° Social", value: (worker as any).numero_social },
        { label: "N° Compte", value: (worker as any).numero_compte },
        { label: "Durée contrat", value: durationLabel((worker as any).duree_contrat) },
        { label: "Début contrat", value: (worker as any).date_debut_contrat ? formatDateFR((worker as any).date_debut_contrat) : null },
        {
          label: "Fin contrat",
          value: (worker as any).date_fin_contrat ? formatDateFR((worker as any).date_fin_contrat) : null,
          chip:
            contractStatus.kind === "expiring" ? (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                Expire dans {contractStatus.daysLeft} j
              </span>
            ) : contractStatus.kind === "expired" ? (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                Expiré depuis {contractStatus.daysOver} j
              </span>
            ) : undefined,
        },
        {
          label: "Date démission",
          value: resignedAt ? formatDateFR(resignedAt) : null,
          tone: resignedAt ? "destructive" : undefined,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero : identité + actions */}
      <div className="panel p-6">
        <div className="mb-4">
          <Link to="/workers"><Button variant="ghost" size="icon-sm" aria-label="Retour à la liste des employés"><ArrowLeft className="h-4 w-4" /></Button></Link>
        </div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
              {initials(worker.full_name)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{worker.full_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {[worker.matricule ? `#${worker.matricule}` : null, worker.position, worker.department].filter(Boolean).join(" • ")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {worker.is_department_head && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Shield className="w-3 h-3" /> Chef de service
                  </span>
                )}
                {hasContractDoc ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-sm font-semibold text-success">
                    ✅ Actif — Contrat en cours
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground">
                    <AlertTriangle className="w-4 h-4" /> Pas de contrat
                  </span>
                )}
                {resignedAt && (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                    Démission — {formatDateFR(resignedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
        {can("employees", "edit") && (
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
                    <Select value={editForm.department ?? ""} onValueChange={(v) => setEditForm((p) => ({ ...p, department: v }))}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner un département" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
        )}
        {canManageContracts && can("employees", "edit") && (
          <RenewContractButton
            workerId={id!}
            workerName={worker?.full_name}
            contract={latestContract}
            variant="outline"
            size="default"
          />
        )}
        {can("employees", "delete") && (
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Supprimer</Button>
        )}
          </div>
        </div>
      </div>

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

      {/* Onglets */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="sticky top-0 z-10 -mx-4 bg-background/90 px-4 py-2 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max gap-1 p-1">
              <TabsTrigger value="apercu" className="gap-2 px-3 py-2">Aperçu</TabsTrigger>
              <TabsTrigger value="acomptes" className="gap-2 px-3 py-2">
                Acomptes
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{acomptes?.length ?? 0}</span>
              </TabsTrigger>
              <TabsTrigger value="absences" className="gap-2 px-3 py-2">
                Absences
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{nbAbsences}</span>
              </TabsTrigger>
              <TabsTrigger value="conges" className="gap-2 px-3 py-2">
                Congés
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{conges?.length ?? 0}</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2 px-3 py-2">
                Documents
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{visibleDocuments.length}</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ============ Onglet 1 : Aperçu ============ */}
        <TabsContent value="apercu" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Ancienneté"
              value={anciennete}
              icon={Clock}
              iconClassName="bg-info/10 text-info"
              hint={worker.hire_date ? `Depuis le ${formatDateFR(worker.hire_date)}` : "Date d'embauche inconnue"}
            />
            <StatCard
              label="Solde d'acompte"
              value={`${fmt(solde)} DA`}
              icon={Wallet}
              iconClassName="bg-primary/10 text-primary"
              hint={solde > 0 ? "Dette en cours" : solde < 0 ? "Crédit" : "Soldé"}
            />
            <StatCard
              label="Congés pris"
              value={`${congeJours} j`}
              icon={CalendarRange}
              iconClassName="bg-success/10 text-success"
              hint={`${conges?.length ?? 0} congé${(conges?.length ?? 0) !== 1 ? "s" : ""} • ${congeJoursHorsWeekend} j hors weekend`}
            />
            <StatCard
              label="Absences"
              value={nbAbsences}
              icon={CalendarX}
              iconClassName="bg-warning/15 text-warning"
              hint={`${nbAbsences} enregistrement${nbAbsences !== 1 ? "s" : ""}`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {infoGroups.map((group) => (
              <section key={group.title} className="panel p-5">
                <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={field.label} className={cn("min-w-0", field.wide && "sm:col-span-2")}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{field.label}</p>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          field.tone === "destructive" && "text-destructive",
                        )}
                      >
                        {field.value || "—"}
                        {field.chip}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </TabsContent>

        {/* ============ Onglet 2 : Acomptes ============ */}
        <TabsContent value="acomptes" className="mt-0 space-y-6">
          {/* Solde acompte */}
          <div className="panel p-5 flex items-center justify-between">
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
          <div>
            <h2 className="text-lg font-semibold mb-3">Historique acomptes ({acomptes?.length ?? 0})</h2>
            {acomptes && acomptes.length > 0 ? (
              <div className="panel overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avant</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Après</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {(acomptes ?? []).map((t) => (
                  <tr key={t.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm align-middle">{formatDateFR(t.transaction_date)}</td>
                    <td className="px-4 py-3 align-middle">
                      {t.type === "reglement" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><TrendingDown className="w-3 h-3" />Règlement</span>
                      ) : t.type === "dette" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"><TrendingUp className="w-3 h-3" />Dette</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning"><TrendingUp className="w-3 h-3" />Acompte</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-middle font-semibold">{fmt(Number(t.amount))} DA</td>
                    <td className="px-4 py-3 text-right align-middle text-sm text-muted-foreground">{fmt(Number(t.previous_balance))}</td>
                    <td className="px-4 py-3 text-right align-middle text-sm font-medium">{fmt(Number(t.new_balance))}</td>
                    <td className="px-4 py-3 text-sm align-middle text-muted-foreground max-w-[200px] truncate">{t.note ?? "—"}</td>
                    <td className="px-4 py-3 text-right align-middle">
                      <Link to={`/acomptes/${t.id}`}><Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            ) : (
              <div className="panel px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun acompte enregistré</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ============ Onglet 3 : Absences ============ */}
        <TabsContent value="absences" className="mt-0 space-y-6">
      {/* Absences */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarX className="w-5 h-5 text-primary" />Absences ({absences?.length ?? 0})</h2>
          <Link to="/absences"><Button variant="outline" size="sm">Gérer</Button></Link>
        </div>
        {absences && absences.length > 0 ? (
          <div className="panel overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motif</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm align-middle">{formatDateFR(a.absence_date)}</td>
                    <td className="px-4 py-3 text-sm align-middle text-muted-foreground">{a.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">Aucune absence enregistrée</p>
          </div>
        )}
      </div>
        </TabsContent>

        {/* ============ Onglet 4 : Congés ============ */}
        <TabsContent value="conges" className="mt-0 space-y-6">
      {/* Congés */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarRange className="w-5 h-5 text-primary" />Congés ({conges?.length ?? 0})</h2>
          <Link to="/conges"><Button variant="outline" size="sm">Gérer</Button></Link>
        </div>
        {conges && conges.length > 0 ? (
          <div className="panel overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Du</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Au</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Durée</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motif</th>
                </tr>
              </thead>
              <tbody>
                {conges.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 text-sm align-middle font-medium">{CONGE_TYPES[c.conge_type]}</td>
                    <td className="px-4 py-3 text-sm align-middle">{formatDateFR(c.start_date)}</td>
                    <td className="px-4 py-3 text-sm align-middle">{formatDateFR(c.end_date)}</td>
                    <td className="px-4 py-3 text-right align-middle text-sm font-semibold">{congeDuration(c.start_date, c.end_date)} j</td>
                    <td className="px-4 py-3 text-sm align-middle text-muted-foreground max-w-[250px] truncate">{c.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun congé enregistré</p>
          </div>
        )}
      </div>
        </TabsContent>

        {/* ============ Onglet 5 : Documents ============ */}
        <TabsContent value="documents" className="mt-0 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3">Documents ({visibleDocuments.length})</h2>
        {loadingDocs ? (
          <ListRowsSkeleton rows={3} />
        ) : visibleDocuments && visibleDocuments.length > 0 ? (
          <div className="panel overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.map((doc) => {
                  const bon = isBon(doc.document_type);
                  const respOk = doc.validated_by_responsible;
                  const rhOk = doc.validated_by_rh;
                  return (
                    <tr key={doc.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 align-middle font-medium">{doc.title}</td>
                      <td className="px-4 py-3 align-middle">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {DOCUMENT_TYPES[doc.document_type as keyof typeof DOCUMENT_TYPES]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {bon ? (
                          respOk && rhOk ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><CheckCircle className="w-3.5 h-3.5" /> Validé</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning"><Clock className="w-3.5 h-3.5" /> En attente</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm align-middle text-muted-foreground">
                        {formatDateFR(doc.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
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
          <div className="panel px-6 py-10 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Aucun document autorisé pour cet employé</p>
          </div>
        )}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
