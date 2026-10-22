import { formatDateFR } from "@/lib/date-utils";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWorkers, getDocuments, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { Users, FileText, LogOut, AlertTriangle, FilePlus, ArrowRight, FileDown, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCardsSkeleton, ListRowsSkeleton } from "@/components/Skeletons";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

// Actions rapides : chaque action est filtrée selon la permission de son
// module-écran (même garde que la route qu'elle ouvre) — aucun lien mort.
const quickActions = [
  { to: "/workers", label: "Gérer employés", description: "Employés & contrats", icon: Users, tone: "text-primary bg-primary/10", module: "employees" as const },
  { to: "/generate/contract", label: "Nouveau contrat", description: "Contrat de travail", icon: FilePlus, tone: "text-primary bg-primary/10", docType: "contract" as string },
  { to: "/generate/bon_sortie", label: "Bon de sortie", description: "Sortie d'employé", icon: LogOut, tone: "text-warning bg-warning/12", docType: "bon_sortie" as string },
  { to: "/generate/avertissement", label: "Avertissement", description: "Sanction disciplinaire", icon: AlertTriangle, tone: "text-destructive bg-destructive/10", docType: "avertissement" as string },
] as const;

export default function Dashboard() {
  const { data: workers, isLoading: loadingWorkers } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: documents, isLoading: loadingDocs } = useQuery({ queryKey: ["documents"], queryFn: getDocuments });
  const {
    can,
    canDocument,
    canAccessWorker,
    visibleDepartments,
    isGlobalScope,
  } = useAuth();

  // Portée : employés et documents hors des départements attribués ne
  // s'affichent ni dans les KPIs, ni dans la liste des documents récents.
  const scopedWorkers = useMemo(() => (workers ?? []).filter((w) => canAccessWorker(w)), [workers, canAccessWorker]);
  const scopedDocs = useMemo(
    () => (documents ?? []).filter(
      (d) => canDocument(d.document_type, "view") && (isGlobalScope || canAccessWorker((d as any).workers)),
    ),
    [documents, canDocument, canAccessWorker, isGlobalScope],
  );

  const docCounts = useMemo(() => scopedDocs.reduce((acc, doc) => {
    acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [scopedDocs]);

  const totalDocs = scopedDocs.length;
  const pct = (key: string) => (totalDocs > 0 ? Math.round(((docCounts[key] ?? 0) / totalDocs) * 100) : 0);

  const recentDocs = useMemo(() => scopedDocs.slice(0, 5), [scopedDocs]);

  const loading = loadingWorkers || loadingDocs;

  const workerCount = scopedWorkers.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre gestion documentaire"
      >
        {isGlobalScope ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Building2 className="w-3.5 h-3.5" />
            Accès global
          </span>
        ) : visibleDepartments.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Building2 className="w-3.5 h-3.5" />
            {visibleDepartments.length === 1
              ? `Département : ${visibleDepartments[0]}`
              : `Départements : ${visibleDepartments.join(", ")}`}
          </span>
        )}
      </PageHeader>

      {loading ? (
        <StatCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Employés"
            value={workerCount}
            icon={Users}
            iconClassName="bg-info/10 text-info"
            hint={`${workerCount} employé${workerCount !== 1 ? "s" : ""} enregistré${workerCount !== 1 ? "s" : ""}`}
          />
          <StatCard
            label={DOCUMENT_TYPES.contract.label}
            value={docCounts.contract ?? 0}
            icon={FilePlus}
            iconClassName="bg-primary/10 text-primary"
            hint={`${pct("contract")}% des documents générés`}
          />
          <StatCard
            label={DOCUMENT_TYPES.bon_sortie.label}
            value={docCounts.bon_sortie ?? 0}
            icon={LogOut}
            iconClassName="bg-warning/15 text-warning"
            hint={`${pct("bon_sortie")}% des documents générés`}
          />
          <StatCard
            label={DOCUMENT_TYPES.avertissement.label}
            value={docCounts.avertissement ?? 0}
            icon={AlertTriangle}
            iconClassName="bg-destructive/10 text-destructive"
            hint={`${pct("avertissement")}% des documents générés`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick actions */}
        <div className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">Actions rapides</h2>
            <FileDown className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {quickActions.map(({ to, label, description, icon: Icon, tone, ...rest }) => {
              // Même garde que la route cible : les écrans /generate/* sont
              // rattachés au module « documents » (le type contrôle l'enregistrement).
              const allowed =
                "module" in rest
                  ? can(rest.module, "view")
                  : "docType" in rest
                    ? can("documents", "view") && canDocument(rest.docType, "create")
                    : false;
              if (!allowed) return null;
              return (
                <Link
                  key={to}
                  to={to}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-background p-3.5 transition-all duration-150 hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="truncate text-xs text-muted-foreground">{description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent documents */}
        <div className="panel flex flex-col p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">Documents récents</h2>
            {can("documents", "view") && (
              <Link to="/documents" className="text-xs font-medium text-primary hover:underline">
                Tout voir
              </Link>
            )}
          </div>
          {loadingDocs ? (
            <div className="flex-1 space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : recentDocs.length > 0 ? (
            <div className="flex-1 divide-y divide-border/70">
              {recentDocs.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateFR(doc.created_at)}</p>
                  </div>
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    {DOCUMENT_TYPES[doc.document_type as keyof typeof DOCUMENT_TYPES]?.label}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="Aucun document"
              description={
                isGlobalScope
                  ? "Les documents créés apparaîtront ici."
                  : "Aucun document dans vos départements."
              }
              className="flex-1 border-0 bg-transparent px-0"
              action={
                can("documents", "view") && canDocument("contract", "create") ? (
                  <Link to="/generate/contract" className="text-sm font-medium text-primary hover:underline">
                    Créer un contrat
                  </Link>
                ) : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
