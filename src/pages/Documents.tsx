import { formatDateFR } from "@/lib/date-utils";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, deleteDocument, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Trash2, CheckCircle, Clock, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import ContractsImportExport from "@/components/ContractsImportExport";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ContractExpirySummary, ContractExpiryBadge } from "@/components/ContractExpiryStatus";
import { getContractExpiry, type ExpiryFilter } from "@/lib/contract-utils";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {documents?.length ?? 0} document{(documents?.length ?? 0) !== 1 ? "s" : ""} généré{(documents?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ContractsImportExport />
        </div>
      </div>

      <div className="space-y-3">
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max gap-1 p-1">
              {documentTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-2 px-3 py-2">
                  {tab.label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
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
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <ContractExpirySummary
        documents={documents ?? []}
        active={expirationFilter}
        onSelect={(s) => {
          const next = s === "all" ? "all" : s;
          if (next !== "all" && typeFilter === "all") setTypeFilter("contract");
          setExpirationFilter(next);
        }}
      />

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : filtered && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="divide-y">
            {filtered.map((doc) => {
                const bon = isBon(doc.document_type);
                const respOk = (doc as any).validated_by_responsible;
                const rhOk = (doc as any).validated_by_rh;
                const fullyValidated = respOk && rhOk;
                const contractExpiry = doc.document_type === "contract" ? getContractExpiry((doc as any).content) : null;
                const rowTint =
                  contractExpiry?.status === "expired"
                    ? "bg-red-50/70 ring-1 ring-inset ring-red-200 dark:bg-red-500/5 dark:ring-red-500/20"
                    : contractExpiry?.status === "expiring"
                      ? "bg-orange-50/50 dark:bg-orange-400/5"
                      : "";

                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5 ${rowTint}`}
                  >
                    <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate font-medium">{doc.title}</p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
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
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle className="w-3.5 h-3.5" /> Validé</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Clock className="w-3.5 h-3.5" /> En attente {respOk ? "(RH)" : rhOk ? "(Chef)" : ""}</span>
                        )
                      ) : doc.document_type === "contract" ? (
                        <ContractExpiryBadge content={(doc as any).content} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
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
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-xl border">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Aucun document {search || typeFilter !== "all" ? "ne correspond à cette recherche" : "créé"}</p>
        </div>
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
