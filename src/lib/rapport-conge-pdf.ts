import jsPDF from "jspdf";
import type { Conge, CongeType } from "./supabase-helpers";
import {
  CONGE_TYPES,
  congeDuration,
  congeDurationExcludingWeekend,
} from "./supabase-helpers";
import { getCongeEntitlement, PERIOD_START_ISO, PERIOD_END_ISO } from "./conge-utils";
import logoErcm from "@/assets/logo-ercm.png";

export interface RapportCongeWorker {
  full_name: string;
  matricule?: string | null;
  department?: string | null;
  hire_date?: string | null;
  date_debut_contrat?: string | null;
  /** Date de démission : plafonne les jours travaillés dans le rapport. */
  date_demission?: string | null;
}

function fmtDateFR(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Dernier jour inclus de la période (periodTo est exclusif). */
function lastDayOfPeriod(periodTo: string): string {
  const d = new Date(`${periodTo}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function imageToDataUrl(src: string): Promise<string> {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Impossible de charger le logo ERCM");
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Impossible de lire le logo ERCM"));
    reader.readAsDataURL(blob);
  });
}

const safeName = (s: string) => s.replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "_");

/**
 * Rapport PDF de tous les congés d'un employé : entête, résumé, répartition
 * par type et historique détaillé (avec pagination).
 *
 * Indépendant du pipeline d'impression des contrats (#document-preview /
 * .a4-sheet) : il utilise jsPDF directement.
 */
export async function generateRapportCongePdf(opts: {
  worker: RapportCongeWorker;
  conges: Conge[];
  periodFrom: string;
  periodTo: string;
}) {
  const { worker, conges, periodFrom, periodTo } = opts;

  const sorted = [...(conges ?? [])].sort((a, b) =>
    a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0,
  );

  // Totaux sur l'historique complet
  const totalJours = sorted.reduce((s, c) => s + congeDuration(c.start_date, c.end_date), 0);
  const totalHorsWeekend = sorted.reduce(
    (s, c) => s + congeDurationExcludingWeekend(c.start_date, c.end_date),
    0,
  );
  const parType = new Map<CongeType, { count: number; jours: number; horsWeekend: number }>();
  for (const c of sorted) {
    const cur = parType.get(c.conge_type) ?? { count: 0, jours: 0, horsWeekend: 0 };
    cur.count += 1;
    cur.jours += congeDuration(c.start_date, c.end_date);
    cur.horsWeekend += congeDurationExcludingWeekend(c.start_date, c.end_date);
    parType.set(c.conge_type, cur);
  }

  // Droits de la période en cours : calcul partagé avec le tableau « Droit de Congé »
  // (même date de référence, même plafonnement à la date de démission).
  const enterDate = worker.hire_date ?? worker.date_debut_contrat ?? null;
  const { dayWorked, congeDroit } = getCongeEntitlement(worker);
  const congeFaitPeriode = sorted
    .filter((c) => c.start_date >= periodFrom && c.start_date < periodTo)
    .reduce((s, c) => s + congeDuration(c.start_date, c.end_date), 0);

  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const red = [206, 22, 29] as const;
  const ink = [26, 26, 46] as const;
  const muted = [100, 106, 115] as const;
  const pale = [246, 247, 249] as const;
  const border = [224, 226, 230] as const;

  const enterDateStr = fmtDateFR(enterDate);
  const today = new Date();
  const generatedAt = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  pdf.setProperties({
    title: `Rapport de congés - ${worker.full_name}`,
    subject: "Rapport de congés ERCM SA",
    author: "ERCM SA",
  });

  // ===== En-tête =====
  try {
    const logoDataUrl = await imageToDataUrl(logoErcm);
    pdf.addImage(logoDataUrl, "PNG", (pageW - 46) / 2, 10, 46, 29, undefined, "FAST");
  } catch {
    // logo optionnel : on continue sans
  }

  let y = 46;
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...red);
  pdf.setFontSize(18);
  pdf.text("Rapport de congés", pageW / 2, y, { align: "center" });

  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...muted);
  pdf.text(`Congés pris du ${fmtDateFR(periodFrom)} au ${fmtDateFR(lastDayOfPeriod(periodTo))}`, pageW / 2, y, { align: "center" });
  y += 4;
  pdf.text(`Exercice de calcul du droit : du ${fmtDateFR(PERIOD_START_ISO)} au ${fmtDateFR(PERIOD_END_ISO)}`, pageW / 2, y, { align: "center" });
  y += 4;
  pdf.text("Jours de repos retenus : jeudi et vendredi", pageW / 2, y, { align: "center" });

  // ===== Bloc employé =====
  y += 10;
  pdf.setDrawColor(...border);
  pdf.setFillColor(...pale);
  pdf.roundedRect(margin, y, contentW, 28, 2, 2, "FD");
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...ink);
  pdf.text(worker.full_name || "—", margin + 6, y);

  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...muted);
  pdf.text(
    `Matricule : ${worker.matricule || "—"}    •    Département : ${worker.department || "—"}    •    Date d'entrée : ${enterDateStr}`,
    margin + 6,
    y,
  );
  y += 18;

  // ===== Résumé période =====
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...ink);
  pdf.text("Droits de congé (période en cours)", margin, y);
  y += 6;

  const summary: Array<[string, string]> = [
    ["Droit de congé", `${congeDroit.toFixed(1)} j`],
    ["Congé pris sur la période", `${congeFaitPeriode} j`],
    ["Reste de congé", `${(congeDroit - congeFaitPeriode).toFixed(1)} j`],
  ];

  const boxW = (contentW - 8) / 3;
  summary.forEach(([label, value], i) => {
    const x = margin + i * (boxW + 4);
    pdf.setFillColor(...pale);
    pdf.setDrawColor(...border);
    pdf.roundedRect(x, y, boxW, 18, 2, 2, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    pdf.text(label, x + 4, y + 6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...ink);
    pdf.text(value, x + 4, y + 13.5);
  });
  y += 26;

  // ===== Totaux historique =====
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...ink);
  pdf.text("Totaux (historique complet)", margin, y);
  y += 6;

  const totals: Array<[string, string]> = [
    ["Nombre de congés", String(sorted.length)],
    ["Total jours de congé", `${totalJours} j`],
    ["Total jours hors weekend", `${totalHorsWeekend} j`],
  ];
  const boxW2 = (contentW - 8) / 3;
  totals.forEach(([label, value], i) => {
    const x = margin + i * (boxW2 + 4);
    pdf.setFillColor(...pale);
    pdf.setDrawColor(...border);
    pdf.roundedRect(x, y, boxW2, 18, 2, 2, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    pdf.text(label, x + 4, y + 6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...ink);
    pdf.text(value, x + 4, y + 13.5);
  });
  y += 24;

  // ===== Répartition par type =====
  if (parType.size > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...ink);
    pdf.text("Répartition par type", margin, y);
    y += 6;
    pdf.setFontSize(8.5);

    for (const [type, agg] of parType.entries()) {
      if (y > pageH - 22) break;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...ink);
      pdf.text(CONGE_TYPES[type] ?? type, margin, y);
      pdf.setTextColor(...muted);
      pdf.text(
        `${agg.count} congé${agg.count > 1 ? "s" : ""} — ${agg.jours} j (${agg.horsWeekend} j hors weekend)`,
        margin + contentW,
        y,
        { align: "right" },
      );
      pdf.setDrawColor(...border);
      pdf.line(margin, y + 1.5, pageW - margin, y + 1.5);
      y += 6;
    }
    y += 4;
  }

  // ===== Historique détaillé =====
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...ink);
  pdf.text("Historique complet des congés", margin, y);
  y += 7;

  const colX = {
    start: margin,
    end: margin + 20,
    type: margin + 44,
    jours: margin + 92,
    hw: margin + 110,
    ref: margin + 136,
    motif: margin + 158,
  };

  const drawTableHeader = (yy: number) => {
    pdf.setFillColor(...pale);
    pdf.setDrawColor(...border);
    pdf.rect(margin, yy - 5, contentW, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text("DÉBUT", colX.start + 1, yy);
    pdf.text("FIN", colX.end + 1, yy);
    pdf.text("TYPE", colX.type + 1, yy);
    pdf.text("JOURS", colX.jours + 1, yy, { align: "right" });
    pdf.text("HORS WK", colX.hw + 1, yy, { align: "right" });
    pdf.text("RÉF.", colX.ref + 1, yy);
    pdf.text("MOTIF", colX.motif + 1, yy);
    return yy + 6;
  };

  y = drawTableHeader(y);

  if (sorted.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(...muted);
    pdf.text("Aucun congé enregistré pour cet employé.", margin, y + 2);
    y += 8;
  }

  pdf.setFontSize(8);
  for (const c of sorted) {
    // Pagination
    if (y > pageH - 20) {
      pdf.addPage();
      y = 18;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...ink);
      pdf.text("Historique complet des congés (suite)", margin, y);
      y += 7;
      y = drawTableHeader(y);
      pdf.setFontSize(8);
    }

    const jours = congeDuration(c.start_date, c.end_date);
    const hw = congeDurationExcludingWeekend(c.start_date, c.end_date);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...ink);
    pdf.text(fmtDateFR(c.start_date), colX.start + 1, y);
    pdf.text(fmtDateFR(c.end_date), colX.end + 1, y);
    pdf.setTextColor(...muted);
    pdf.text((CONGE_TYPES[c.conge_type as CongeType] ?? c.conge_type).replace("Congé ", ""), colX.type + 1, y);
    pdf.text(String(jours), colX.jours + 20, y, { align: "right" });
    pdf.setTextColor(...red);
    pdf.text(String(hw), colX.hw + 16, y, { align: "right" });
    pdf.setTextColor(...muted);
    pdf.text(String((c as any).reference || "—"), colX.ref + 1, y);
    const motif = String(c.reason ?? "—").slice(0, 34);
    pdf.text(motif, colX.motif + 1, y);

    pdf.setDrawColor(...border);
    pdf.line(margin, y + 1.8, pageW - margin, y + 1.8);
    y += 6.5;
  }

  // ===== Pieds de page =====
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    pdf.text(`Rapport généré le ${generatedAt}`, margin, pageH - 10);
    pdf.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 10, { align: "right" });
  }

  pdf.save(`RAPPORT_CONGE_${safeName(worker.full_name || "employe")}.pdf`);
}