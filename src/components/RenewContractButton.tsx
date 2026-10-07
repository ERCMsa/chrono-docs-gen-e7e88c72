import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createDocumentWithReference, updateWorker } from "@/lib/supabase-helpers";
import { computeContractEnd } from "@/lib/contract-helpers";
import { formatDateFR } from "@/lib/contract-utils";
import { cn } from "@/lib/utils";

interface RenewContractButtonProps {
  /** Employé concerné par le renouvellement. */
  workerId: string;
  workerName?: string | null;
  /** Document contrat expiré à copier (le dernier contrat en date). */
  contract: { content: unknown } | null | undefined;
  variant?: "outline" | "secondary" | "ghost";
  size?: "sm" | "default";
  className?: string;
  /** Libellé du bouton (par défaut « Renouveler le contrat »). */
  label?: string;
}

/**
 * Bouton + dialogue de renouvellement d'un contrat expiré.
 *
 * Réplique exactement le comportement de la page détail employé :
 * un nouveau contrat est créé en copiant le contenu du contrat précédent
 * (hors référence / numéro / avenant), les dates de début et de fin sont
 * recalculées, et l'employé est mis à jour. L'ancien contrat est conservé.
 */
export default function RenewContractButton({
  workerId,
  workerName,
  contract,
  variant = "outline",
  size = "sm",
  className,
  label = "Renouveler le contrat",
}: RenewContractButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [renewEndDate, setRenewEndDate] = useState("");

  const content = (contract?.content as Record<string, any> | undefined) ?? null;
  const latestEnd = content?.date_fin as string | undefined;
  const todayStr = new Date().toISOString().slice(0, 10);
  // Renouvellement possible uniquement si le contrat est expiré
  const isExpired = !!latestEnd && latestEnd < todayStr;
  const dayAfter = (d: string) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + 1);
    return dt.toISOString().slice(0, 10);
  };
  const renewStart = latestEnd ? dayAfter(latestEnd) : todayStr;
  const prevMois = parseInt(content?.duree_mois ?? "", 10);
  const autoRenewEnd = prevMois ? computeContractEnd(renewStart, prevMois) : "";

  const renewMutation = useMutation({
    mutationFn: async () => {
      const end = autoRenewEnd || renewEndDate;
      if (!end) throw new Error("Date de fin requise");
      const prevContent: Record<string, any> = { ...(content ?? {}) };
      delete prevContent.reference;
      delete prevContent.num_contrat;
      delete prevContent.avenant;
      const newContent = { ...prevContent, date_debut: renewStart, date_fin: end };
      const doc = await createDocumentWithReference({
        worker_id: workerId,
        document_type: "contract",
        title: `Contrat de travail - ${workerName ?? ""}`.trim(),
        content: newContent,
      } as any);
      await updateWorker(workerId, {
        date_debut_contrat: renewStart,
        date_fin_contrat: end,
        duree_contrat: prevMois ? String(prevMois) : null,
      } as any);
      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", workerId] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["worker-documents", workerId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["workers-with-contract"] });
      setOpen(false);
      setRenewEndDate("");
      toast.success("Contrat renouvelé");
    },
    onError: () => toast.error("Erreur lors du renouvellement"),
  });

  const name = workerName || "l'employé";

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant={variant}
                size={size}
                disabled={!isExpired || renewMutation.isPending}
                onClick={() => setOpen(true)}
                className={cn("whitespace-nowrap", className)}
              >
                <RefreshCw className={cn("h-4 w-4", size === "sm" ? "mr-2" : "mr-2")} />
                {label}
              </Button>
            </span>
          </TooltipTrigger>
          {!isExpired && (
            <TooltipContent>Le contrat actuel est encore actif</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Renouveler le contrat</DialogTitle>
            <DialogDescription>
              Un nouveau contrat sera créé pour {name} en copiant toutes les informations du contrat
              précédent. L'ancien contrat est conservé.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              Début : <span className="font-semibold">{formatDateFR(renewStart)}</span>
              {autoRenewEnd && (
                <>
                  {" → "}
                  Fin : <span className="font-semibold">{formatDateFR(autoRenewEnd)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    (même durée que le contrat précédent)
                  </span>
                </>
              )}
            </div>
            {!autoRenewEnd && (
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date de fin du nouveau contrat *
                </Label>
                <DateInput value={renewEndDate} onChange={(e) => setRenewEndDate(e.target.value)} className="h-11" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => renewMutation.mutate()}
              disabled={renewMutation.isPending || (!autoRenewEnd && !renewEndDate)}
            >
              {renewMutation.isPending ? "..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}