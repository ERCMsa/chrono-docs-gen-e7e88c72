import { formatDateFR } from "@/lib/date-utils";
import { useQuery } from "@tanstack/react-query";
import { getWorkers, getDocuments, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { Users, FileText, LogOut, AlertTriangle, FilePlus, ArrowRight, FileDown } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatCardsSkeleton, ListRowsSkeleton } from "@/components/Skeletons";
import { Badge } from "@/components/ui/badge";

const quickActions = [
  { to: "/workers", label: "Gérer employés", description: "Employés & contrats", icon: Users, tone: "text-primary bg-primary/10" },
  { to: "/generate/contract", label: "Nouveau contrat", description: "Contrat de travail", icon: FilePlus, tone: "text-primary bg-primary/10" },
  { to: "/generate/bon_sortie", label: "Bon de sortie", description: "Sortie d'employé", icon: LogOut, tone: "text-warning bg-warning/12" },
  { to: "/generate/avertissement", label: "Avertissement", description: "Sanction disciplinaire", icon: AlertTriangle, tone: "text-destructive bg-destructive/10" },
] as const;

export default function Dashboard() {
  const { data: workers, isLoading: loadingWorkers } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const { data: documents, isLoading: loadingDocs } = useQuery({ queryKey: ["documents"], queryFn: getDocuments });

  const docCounts = documents?.reduce((acc, doc) => {
    acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const totalDocs = documents?.length ?? 0;
  const pct = (key: string) => (totalDocs > 0 ? Math.round(((docCounts[key] ?? 0) / totalDocs) * 100) : 0);

  const loading = loadingWorkers || loadingDocs;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre gestion documentaire"
      />

      {loading ? (
        <StatCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Employés"
            value={workers?.length ?? 0}
            icon={Users}
            iconClassName="bg-info/10 text-info"
            hint={`${workers?.length ?? 0} employé${(workers?.length ?? 0) !== 1 ? "s" : ""} enregistré${(workers?.length ?? 0) !== 1 ? "s" : ""}`}
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
            {quickActions.map(({ to, label, description, icon: Icon, tone }) => (
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
            ))}
          </div>
        </div>

        {/* Recent documents */}
        <div className="panel flex flex-col p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">Documents récents</h2>
            <Link to="/documents" className="text-xs font-medium text-primary hover:underline">
              Tout voir
            </Link>
          </div>
          {loadingDocs ? (
            <div className="flex-1 space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="flex-1 divide-y divide-border/70">
              {documents.slice(0, 5).map((doc) => (
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
              description="Les documents créés apparaîtront ici."
              className="flex-1 border-0 bg-transparent px-0"
              action={
                <Link to="/generate/contract" className="text-sm font-medium text-primary hover:underline">
                  Créer un contrat
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}