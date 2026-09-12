import { formatDateFR } from "@/lib/date-utils";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DOCUMENT_TYPES, validateDocument } from "@/lib/supabase-helpers";
import { exportToPdf } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Printer, CheckCircle, Shield, AlertCircle, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import DocumentPreview from "@/components/DocumentPreview";
import AvenantPreview, { EMPTY_AVENANT, type AvenantData } from "@/components/AvenantPreview";
import logoErcm from "@/assets/logo-ercm.png";

import type { Json } from "@/integrations/supabase/types";

export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user: authUser, role, isAdmin } = useAuth();

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, workers(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Role-based validation: chef de service = user's role matches worker's department.
  // RH = user has RH role. ADMIN can do both.
  const worker = (doc as any)?.workers;
  const workerDept = (worker?.department ?? "").trim().toUpperCase();
  const userRole = (role ?? "").toUpperCase();

  const canValidateResponsible =
    isAdmin() || (!!userRole && !!workerDept && userRole === workerDept);
  const canValidateRH = isAdmin() || userRole === "RH";

  const validateMutation = useMutation({
    mutationFn: ({ role: r }: { role: "responsible" | "rh" }) =>
      validateDocument(id!, r, authUser?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      toast.success("Document validé");
    },
    onError: () => toast.error("Erreur de validation"),
  });

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;
  if (!doc) return <p className="text-destructive">Document introuvable</p>;

  const content = doc.content as Record<string, Json>;
  const docType = doc.document_type as keyof typeof DOCUMENT_TYPES;
  const formData: Record<string, string> = {};
  for (const [k, v] of Object.entries(content)) {
    if (typeof v === "string") formData[k] = v;
  }

  const isBon = docType === "bon_sortie" || docType === "bon_entree";
  const isContract = docType === "contract";
  const isValidatedResp = doc.validated_by_responsible;
  const isValidatedRh = doc.validated_by_rh;

  const rawAvenant = (content as any).avenant;
  const avenantData: AvenantData | null =
    isContract && rawAvenant && typeof rawAvenant === "object"
      ? { ...EMPTY_AVENANT, ...(rawAvenant as Partial<AvenantData>) }
      : null;

  const printAvenant = () => {
    document.body.classList.add("print-avenant");
    const cleanup = () => {
      document.body.classList.remove("print-avenant");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 50);
  };

  const displayName = authUser?.full_name || authUser?.username || "—";


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/documents"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">Créé le {formatDateFR(doc.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/generate/${docType}/${doc.id}`}>
            <Button variant="outline" size="sm">
              <Pencil className="w-4 h-4 mr-2" />Modifier
            </Button>
          </Link>
          <Button onClick={() => window.print()} variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />Imprimer
          </Button>
          <Button onClick={() => exportToPdf("document-preview", doc.title)} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />PDF
          </Button>
        </div>
      </div>

      {/* Validation panel for bon_sortie */}
      {isBon && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Validation du document</h3>

          {!canValidateResponsible && !canValidateRH && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Votre rôle ({userRole || "—"}) ne permet pas de valider ce document.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chef de service validation */}
            <div className={`border rounded-lg p-4 ${isValidatedResp ? "border-green-500 bg-green-50" : "border-muted"}`}>
              <p className="font-medium text-sm mb-2">Chef de Service</p>
              {isValidatedResp ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Validé {doc.responsible_validated_at ? `le ${formatDateFR(doc.responsible_validated_at)}` : ""}</span>
                </div>
              ) : canValidateResponsible ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Connecté en tant que : {displayName} ({userRole})</p>
                  <Button size="sm" className="w-full" disabled={validateMutation.isPending} onClick={() => validateMutation.mutate({ role: "responsible" })}>
                    Valider (Chef de Service)
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Seul le chef de service du département «{worker?.department || "—"}» peut valider.
                  </p>
                  <Button size="sm" className="w-full" disabled>
                    Valider (Chef de Service)
                  </Button>
                </div>
              )}
            </div>

            {/* RH validation */}
            <div className={`border rounded-lg p-4 ${isValidatedRh ? "border-green-500 bg-green-50" : "border-muted"}`}>
              <p className="font-medium text-sm mb-2">RH</p>
              {isValidatedRh ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Validé {doc.rh_validated_at ? `le ${formatDateFR(doc.rh_validated_at)}` : ""}</span>
                </div>
              ) : canValidateRH ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Connecté en tant que : {displayName} (RH)</p>
                  <Button size="sm" className="w-full" disabled={validateMutation.isPending} onClick={() => validateMutation.mutate({ role: "rh" })}>
                    Valider (RH)
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Seul un membre du département RH peut valider.</p>
                  <Button size="sm" className="w-full" disabled>
                    Valider (RH)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div id="document-preview">
        <DocumentPreview
          type={docType}
          worker={worker}
          data={formData}
          validationStatus={isBon ? {
            validated_by_responsible: isValidatedResp,
            validated_by_rh: isValidatedRh,
            responsible_validated_at: doc.responsible_validated_at,
            rh_validated_at: doc.rh_validated_at,
          } : undefined}
        />
      </div>

      {avenantData && worker && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 border-t pt-6">
            <h2 className="text-lg font-semibold">Avenant nº {avenantData.numAvenant}</h2>
            <div className="flex gap-2">
              <Button onClick={printAvenant} variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" />Imprimer l'avenant
              </Button>
              <Button onClick={() => exportToPdf("avenant-preview", `Avenant_${avenantData.numAvenant}_${worker.full_name}`)} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />PDF Avenant
              </Button>
            </div>
          </div>
          <div id="avenant-preview">
            <AvenantPreview
              worker={worker}
              avenant={avenantData}
              contractData={formData}
              logoDataUrl={formData.logoDataUrl || logoErcm}
            />
          </div>
        </div>
      )}
    </div>
  );
}

