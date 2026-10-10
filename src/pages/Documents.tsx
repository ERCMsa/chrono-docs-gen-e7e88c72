import { formatDateFR } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkers, getDocuments, deleteDocument, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Trash2, CheckCircle, Clock, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListRowsSkeleton } from "@/components/Skeletons";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ContractExpirySummary, ContractExpiryBadge } from "@/components/ContractExpiryStatus";
import RenewContractButton from "@/components/RenewContractButton";
import SansContratExpiryList from "@/components/SansContratExpiryList";
import {
  getContractExpiry,
  latestContractsByWorker,
  getSansContratExpiries,
  type ExpiryFilter,
} from "@/lib/contract-utils";

export default function Documents() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expirationFilter, setExpirationFilter] = useState<ExpiryFilter>("all");
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const { data: documents, isLoading } = useQuery({ queryKey: ["documents"], queryFn: getDocuments });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] }); queryClient.invalidateQueries({ queryKey: ["workers-with-contract"] });
      toast.success("Document supprimé");
      setToDelete(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  // Dernier contrat par employé : un contrat renouvelé garde son ancien document,
  // qui ne doit plus compter ni apparaître dans les filtres d'expiration.
  const latestContracts = useMemo(() => latestContractsByWorker(documents), [documents]);
  const latestContractIds = useMemo(
    () => new Set([...latestContracts.values()].map((d) => d.id as string)),
    [latestContracts],
  );
  const isSuperseded = (doc: any) =>
    doc.document_type === "contract" &&
    !!doc.worker_id &&
    latestContracts.has(doc.worker_id) &&
    latestContracts.get(doc.worker_id)!.id !== doc.id;

  // Employés sans document contrat : échéance implicite = date d'embauche + 1 an.
  // L'ensemble « avec contrat » est dérivé des documents déjà chargés (aucun appel API).
  const { data: workers } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const workerIdsWithContract = useMemo(() => {
    const ids = new Set<string>();
    for (const doc of documents ?? []) {
      if (doc.document_type === "contract" && doc.worker_id) ids.add(doc.worker_id);
    }
    return ids;
  }, [documents]);
  const sansContratExpiries = useMemo(
    () => getSansContratExpiries(workers, workerIdsWithContract),
    [workers, workerIdsWithContract],
  );

  // Employés démissionnaires : exclus des vues d'expiration (avec ou sans contrat),
  // leurs contrats ne sont plus à renouveler.
  const resignedWorkerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of workers ?? []) {
      if (w?.id && (w as any).date_demission) ids.add(w.id);
    }
    return ids;
  }, [workers]);

  const filtered = documents?.filter((doc) => {
    const matchesType = typeFilter === "all" || doc.document_type === typeFilter;
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [
      doc.title,
      (doc as any).reference,
      (doc as any).workers?.full_name,
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
    const matchesExpiry =
      expirationFilter === "all" ||
      doc.document_type !== "contract" ||
      (!doc.worker_id || !resignedWorkerIds.has(doc.worker_id)) &&
        latestContractIds.has(doc.id) &&
        getContractExpiry((doc as any).content)?.status === expirationFilter;
    return matchesType && matchesSearch && matchesExpiry;
  });

  const isBon = (type: string) => type === "bon_sortie" || type === "bon_entree";
  const documentTabs = [
    { key: "all", label: "Tous" },
    ...Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => ({ key, label })),
  ];

  const countForType = (type: string) => type === "all"
    ? documents?.length ?? 0
    : documents?.filter((doc) => doc.document_type === type).length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description={`${documents?.length ?? 0} document${(documents?.length ?? 0) !== 1 ? "s" : ""} généré${(documents?.length ?? 0) !== 1 ? "s" : ""}`}
      >
      </PageHeader>

      <div className="space-y-3">
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max gap-1 p-1">
              {documentTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-2 px-3 py-2">
                  {tab.label}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {countForType(tab.key)}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un document ou un employé"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <ContractExpirySummary
        documents={documents ?? []}
        active={expirationFilter}
        sansContrat={sansContratExpiries}
        excludedWorkerIds={resignedWorkerIds}
        onSelect={(s) => {
          const next = s === "all" ? "all" : s;
          if (next !== "all" && typeFilter === "all") setTypeFilter("contract");
          setExpirationFilter(next);
        }}
      />

      <SansContratExpiryList items={sansContratExpiries} active={expirationFilter} />

      {isLoading ? (
        <ListRowsSkeleton />
      ) : filtered && filtered.length > 0 ? (
        <div className="panel divide-y">
          {filtered.map((doc) => {
            const bon = isBon(doc.document_type);
            const respOk = (doc as any).validated_by_responsible;
            const rhOk = (doc as any).validated_by_rh;
            const fullyValidated = respOk && rhOk;
            const contractExpiry = doc.document_type === "contract" ? getContractExpiry((doc as any).content) : null;
            const rowTint =
              contractExpiry?.status === "expired"
                ? "bg-destructive/5"
                : contractExpiry?.status === "expiring"
                  ? "bg-warning/5"
                  : "";

            return (
              <div
                key={doc.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-nowrap sm:px-5 ${rowTint}`}
              >
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate font-medium">{doc.title}</p>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {DOCUMENT_TYPES[doc.document_type as keyof typeof DOCUMENT_TYPES]?.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {(doc as any).workers?.full_name ?? "Employé non renseigné"}
                    {(doc as any).reference ? ` · ${(doc as any).reference}` : ""}
                    {` · ${formatDateFR(doc.created_at)}`}
                  </p>
                </div>
                <div className="hidden shrink-0 md:block">
                  {bon ? (
                    fullyValidated ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><CheckCircle className="h-3.5 w-3.5" /> Validé</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning"><Clock className="h-3.5 w-3.5" /> En attente {respOk ? "(RH)" : rhOk ? "(Chef)" : ""}</span>
                    )
                  ) : doc.document_type === "contract" ? (
                    <ContractExpiryBadge content={(doc as any).content} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                {/* Contrat obsolète : conservé dans la liste, mais plus de renouvellement possible */}
                {isSuperseded(doc) && (
                  <span className="hidden shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground md:inline-flex">
                    Remplacé
                  </span>
                )}
                {/* Renouvellement proposé sur les contrats expirés en cours (jamais pour un démissionnaire) */}
                {contractExpiry?.status === "expired" &&
                  (doc as any).worker_id &&
                  !resignedWorkerIds.has((doc as any).worker_id) &&
                  latestContractIds.has(doc.id) && (
                    <RenewContractButton
                      workerId={(doc as any).worker_id}
                      workerName={(doc as any).workers?.full_name ?? null}
                      contract={doc as any}
                    />
                  )}
                <div className="flex shrink-0 items-center gap-1">
                  <Link to={`/documents/${doc.id}`} aria-label={`Voir ${doc.title}`}>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" aria-label={`Supprimer ${doc.title}`} onClick={() => setToDelete({ id: doc.id, title: doc.title })}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="Aucun document"
          description={
            search || typeFilter !== "all"
              ? "Aucun document ne correspond à votre recherche. Essayez de modifier vos filtres ou votre terme de recherche."
              : "Aucun document n'a encore été généré. Les documents créés apparaîtront ici."
          }
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document <strong>« {toDelete?.title} »</strong> sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
