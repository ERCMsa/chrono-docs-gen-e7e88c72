import * as XLSX from "xlsx";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PERIOD_START_ISO, PERIOD_END_ISO } from "@/lib/conge-utils";
import type { DroitCongeRow } from "@/lib/conge-utils";

/** Type partagé avec le tableau « Droit de Congé » (source unique). */
export type DroitCongeExportRow = DroitCongeRow;

interface Props {
  /** Lignes du tableau telles qu'affichées (filtres de recherche inclus). */
  rows: DroitCongeExportRow[];
  periodFrom: string;
  periodTo: string;
  className?: string;
  disabled?: boolean;
}

const HEADERS = [
  "MATRICULE",
  "Employé",
  "Mois travaillés",
  "Congé fait (j)",
  "Congé fait sans weekend (j)",
  "Droit de congé (j)",
  "Reste de congé (j)",
  "Date d'entrée",
];

const COL_WIDTHS = [
  { wch: 14 },
  { wch: 28 },
  { wch: 16 },
  { wch: 15 },
  { wch: 30 },
  { wch: 18 },
  { wch: 18 },
  { wch: 15 },
];

function fmtDateFR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Dernier jour inclus de la période (periodTo est exclusif). */
function lastDayOfPeriod(periodTo: string): string {
  const d = new Date(`${periodTo}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Export Excel du tableau « Droit de Congé ».
 *
 * Structure du fichier : bloc titre + métadonnées, ligne d'en-têtes avec filtre
 * automatique, une ligne par employé, puis une ligne de totaux.
 * Utilise xlsx (SheetJS) déjà présent dans le projet.
 */
export default function DroitCongeExcelExport({ rows, periodFrom, periodTo, className, disabled }: Props) {
  const handleExport = () => {
    if (!rows || rows.length === 0) {
      toast.error("Aucun employé à exporter");
      return;
    }

    try {
      const today = new Date();
      const generatedAt = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
      const periodEnd = lastDayOfPeriod(periodTo);

      const totalFait = rows.reduce((s, r) => s + (r.congeFait || 0), 0);
      const totalHorsWeekend = rows.reduce((s, r) => s + (r.congeFaitHorsWeekend || 0), 0);
      const totalDroit = rows.reduce((s, r) => s + (r.congeDroit || 0), 0);

      const headerRowIdx = 6; // 0-based
      const firstDataRow = headerRowIdx + 2; // 1-based dans la feuille
      const lastDataRow = firstDataRow + rows.length - 1;

      const aoa: Array<Array<string | number>> = [
        ["DROIT DE CONGÉ"],
        ["Période", `du ${fmtDateFR(periodFrom)} au ${fmtDateFR(periodEnd)}`],
        ["Généré le", generatedAt],
        ["Jours de repos exclus", "jeudi et vendredi"],
        ["Exercice (droit de congé)", `du ${fmtDateFR(PERIOD_START_ISO)} au ${fmtDateFR(PERIOD_END_ISO)}`],
        [],
        HEADERS,
        ...rows.map((r) => [
          r.matricule,
          r.name,
          Number(r.monthWorked) || 0,
          Number(r.congeFait) || 0,
          Number(r.congeFaitHorsWeekend) || 0,
          Number(r.congeDroit) || 0,
          Number(r.resteConge) || 0,
          fmtDateFR(r.enterDate),
        ]),
        [
          "TOTAL",
          `${rows.length} employé${rows.length > 1 ? "s" : ""}`,
          "",
          totalFait,
          totalHorsWeekend,
          Number(totalDroit.toFixed(1)),
          Number((totalDroit - totalFait).toFixed(1)),
          "",
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Formats numériques : entiers pour les jours, 1 décimale pour les droits
      for (let i = 0; i < rows.length; i++) {
        const r = firstDataRow + i;
        ws[`C${r}`].z = "0.0"; // mois travaillés
        ws[`D${r}`].z = "0"; // congé fait
        ws[`E${r}`].z = "0"; // congé fait sans weekend
        ws[`F${r}`].z = "0.0"; // droit de congé
        ws[`G${r}`].z = "0.0"; // reste de congé
      }
      // Ligne de totaux : juste après la dernière ligne de données
      const totalRow = lastDataRow + 1;
      if (ws[`D${totalRow}`]) ws[`D${totalRow}`].z = "0";
      if (ws[`E${totalRow}`]) ws[`E${totalRow}`].z = "0";
      if (ws[`F${totalRow}`]) ws[`F${totalRow}`].z = "0.0";
      if (ws[`G${totalRow}`]) ws[`G${totalRow}`].z = "0.0";

      ws["!cols"] = COL_WIDTHS;
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];
      ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { r: headerRowIdx, c: 0 },
          e: { r: headerRowIdx + rows.length, c: HEADERS.length - 1 },
        }),
      };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Droit de Conge");
      XLSX.writeFile(wb, `Droit_de_conge_${periodFrom.slice(0, 4)}.xlsx`);
      toast.success("Export Excel généré");
    } catch {
      toast.error("Erreur lors de l'export Excel");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled}
      onClick={handleExport}
      title="Exporter le tableau en Excel"
    >
      <FileSpreadsheet className="mr-2 h-4 w-4" />
      Exporter Excel
    </Button>
  );
}