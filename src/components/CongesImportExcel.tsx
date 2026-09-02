import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { createConge, type Worker } from "@/lib/supabase-helpers";
import { toISODate } from "@/lib/date-utils";

interface Props {
  workers: Worker[] | undefined;
  onImported: () => void;
}

const normMat = (v: unknown) =>
  String(v ?? "").trim().replace(/\s+/g, "").replace(/^0+/, "").toUpperCase();

function cellToISO(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return toISODate(v);
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p) return "";
    return toISODate(new Date(p.y, p.m - 1, p.d));
  }
  return toISODate(String(v));
}

export default function CongesImportExcel({ workers, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["StartDate", "EndDate", "Matricule"],
      ["2026-09-01", "2026-09-15", "126"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conges");
    XLSX.writeFile(wb, "modele_conges.xlsx");
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) throw new Error("Fichier vide");

      const byMat = new Map<string, Worker>();
      (workers ?? []).forEach((w) => {
        const m = normMat((w as any).matricule);
        if (m) byMat.set(m, w);
      });

      let success = 0;
      const errors: string[] = [];

      for (const [i, row] of rows.entries()) {
        const line = i + 2;
        const get = (name: string) => {
          const key = Object.keys(row).find((k) => k.trim().toLowerCase() === name);
          return key ? row[key] : "";
        };
        const start = cellToISO(get("startdate"));
        const end = cellToISO(get("enddate"));
        const mat = normMat(get("matricule"));

        if (!mat) { errors.push(`L${line}: matricule manquant`); continue; }
        if (!start || !end) { errors.push(`L${line}: dates invalides`); continue; }
        const worker = byMat.get(mat);
        if (!worker) { errors.push(`L${line}: employé #${mat} introuvable`); continue; }
        if (new Date(end) < new Date(start)) { errors.push(`L${line}: fin avant début`); continue; }

        try {
          await createConge({ worker_id: worker.id, start_date: start, end_date: end, conge_type: "annual" });
          success++;
        } catch (e: any) {
          errors.push(`L${line} (${worker.full_name}): ${e?.message ?? "erreur"}`);
        }
      }

      if (success > 0) toast.success(`${success} congé(s) importé(s)`);
      if (errors.length > 0) toast.error(`${errors.length} ligne(s) ignorée(s) — ${errors[0]}`);
      if (success === 0 && errors.length === 0) toast.error("Aucune ligne valide");
      onImported();
    } catch (e: any) {
      toast.error(e?.message ?? "Import impossible");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Button variant="outline" onClick={downloadTemplate} title="Télécharger le modèle Excel">
        <Download className="w-4 h-4 mr-2" />Modèle
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        <FileSpreadsheet className="w-4 h-4 mr-2" />{busy ? "Import..." : "Importer Excel"}
      </Button>
    </>
  );
}
