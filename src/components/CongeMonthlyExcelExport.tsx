import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildMonthlyCongeMatrix } from "@/lib/conge-monthly";
import { buildCongeMonthlyWorkbook, congeMonthlyFileName, type ExcelJSModule } from "@/lib/conge-monthly-excel";
import { CONGE_TYPES } from "@/lib/supabase-helpers";
import type { Conge } from "@/lib/supabase-helpers";
import type { DroitCongeRow } from "@/lib/conge-utils";

interface Props {
  /** Lignes affichées du tableau « Droit de Congé » (recherche, tri, permissions). */
  rows: DroitCongeRow[];
  /** Congés de la période déjà chargés par l'écran. */
  conges: Conge[];
  periodFrom: string;
  periodTo: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Export Excel « Détail par mois » : une matrice employés × mois.
 *
 * Seuls les mois contenant au moins un congé apparaissent en colonne, et seuls
 * les employés ayant au moins un congé apparaissent en ligne. Chaque cellule
 * remplie porte un commentaire détaillant les congés du mois (dates, type,
 * jours, motif). Le total « Congé fait sans weekend » est identique à celui du
 * tableau.
 *
 * ExcelJS est chargé à la demande (import dynamique) pour ne pas alourdir le
 * bundle initial.
 */
export default function CongeMonthlyExcelExport({ rows, conges, periodFrom, periodTo, className, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (!rows || rows.length === 0) {
      toast.error("Aucun employé à exporter");
      return;
    }

    setBusy(true);
    try {
      const matrix = buildMonthlyCongeMatrix(rows, conges ?? [], { from: periodFrom, to: periodTo });
      if (matrix.rows.length === 0 || matrix.months.length === 0) {
        toast.error("Aucun congé à exporter sur la période");
        return;
      }

      // Import dynamique : le bundle ExcelJS (~940 kB) n'est chargé qu'au clic.
      // La build navigateur est un UMD : selon l'interop, la classe se trouve
      // sur le module lui-même ou sur sa propriété `default`.
      type LoadedModule = ExcelJSModule & { default?: ExcelJSModule };
      const mod = (await import("exceljs")) as LoadedModule;
      const ExcelJS: ExcelJSModule = mod.default ?? mod;

      const buffer = await buildCongeMonthlyWorkbook(ExcelJS, matrix, {
        periodFrom,
        periodTo,
        typeLabel: (t) => CONGE_TYPES[t as keyof typeof CONGE_TYPES] ?? t,
      });

      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = congeMonthlyFileName(periodFrom);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast.success("Export Excel généré");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled || busy}
      onClick={handleExport}
      title="Exporter les congés en détail, mois par mois (Excel)"
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="mr-2 h-4 w-4" />
      )}
      {busy ? "Génération..." : "Détail par mois"}
    </Button>
  );
}
