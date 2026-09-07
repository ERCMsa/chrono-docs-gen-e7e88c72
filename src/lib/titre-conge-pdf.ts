import jsPDF from "jspdf";
import type { CongeWithWorker } from "./supabase-helpers";
import { CONGE_TYPES, congeDuration } from "./supabase-helpers";
import logoErcm from "@/assets/logo-ercm.png";

const UNITS = ["", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF", "DIX",
  "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE", "DIX-SEPT", "DIX-HUIT", "DIX-NEUF"];
const TENS = ["", "", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE", "SOIXANTE", "QUATRE-VINGT", "QUATRE-VINGT"];

function numToFrench(n: number): string {
  if (n === 0) return "ZERO";
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 7 || t === 9) {
      const base = TENS[t];
      const rest = 10 + u;
      return u === 0 ? base + " " + UNITS[10] : base + " " + UNITS[rest];
    }
    if (u === 0) return TENS[t];
    if (u === 1 && t !== 8) return TENS[t] + " ET UN";
    return TENS[t] + " " + UNITS[u];
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const rest = n % 100;
    const prefix = c === 1 ? "CENT" : UNITS[c] + " CENT" + (rest === 0 ? "S" : "");
    return rest === 0 ? prefix : prefix + " " + numToFrench(rest);
  }
  return String(n);
}

function fmtDateFR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function imageToDataUrl(src: string): Promise<string> {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Impossible de charger le logo ERCM");
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Impossible de lire le logo ERCM"));
    reader.readAsDataURL(blob);
  });
}

export async function generateTitreCongePdf(conge: CongeWithWorker, refNumber?: number) {
  const worker = conge.workers;
  const fullName = (worker?.full_name || "").trim();
  const parts = fullName.split(/\s+/);
  const nom = parts[0] || "";
  const prenom = parts.slice(1).join(" ") || "";
  const fonction = (worker as any)?.position || (worker as any)?.department || "";
  const days = congeDuration(conge.start_date, conge.end_date);
  const daysWords = numToFrench(days);
  const nature = CONGE_TYPES[conge.conge_type].toUpperCase();
  const year = new Date(conge.start_date).getFullYear();
  const ref = `${String(refNumber ?? 1).padStart(2, "0")}./ ${year}`;
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const red = [206, 22, 29] as const;
  const ink = [26, 26, 46] as const;
  const muted = [100, 106, 115] as const;
  const pale = [248, 248, 249] as const;

  pdf.setProperties({
    title: `Titre de congé - ${fullName}`,
    subject: "Titre de congé ERCM SA",
    author: "ERCM SA",
  });

  try {
    const logoDataUrl = await imageToDataUrl(logoErcm);
    const logoW = 52;
    const logoH = 33;
    pdf.addImage(logoDataUrl, "PNG", (pageW - logoW) / 2, 10, logoW, logoH, undefined, "FAST");
  } catch (error) {
    console.error("Logo ERCM non chargé dans le titre de congé", error);
  }

  pdf.setDrawColor(...red);
  pdf.setLineWidth(0.8);
  pdf.line(margin, 47, pageW - margin, 47);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...ink);
  pdf.setFontSize(20);
  pdf.text("TITRE DE CONGE", pageW / 2, 59, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...muted);
  pdf.setFontSize(9);
  pdf.text("DOCUMENT ADMINISTRATIF", pageW / 2, 65, { align: "center" });

  pdf.setFillColor(...pale);
  pdf.setDrawColor(224, 225, 228);
  pdf.roundedRect(margin, 72, contentW, 14, 2, 2, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...ink);
  pdf.setFontSize(10);
  pdf.text(`REF. N° ${ref}`, margin + 5, 81);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...muted);
  pdf.text(`ETABLI LE ${todayStr}`, pageW - margin - 5, 81, { align: "right" });

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...red);
  pdf.setFontSize(10);
  pdf.text("BENEFICIAIRE", margin, 99);
  pdf.setDrawColor(...red);
  pdf.setLineWidth(0.45);
  pdf.line(margin, 102, margin + 29, 102);

  const infoX = margin;
  const infoY = 108;
  const infoH = 43;
  const labelW = 42;
  pdf.setDrawColor(218, 220, 224);
  pdf.setFillColor(252, 252, 253);
  pdf.roundedRect(infoX, infoY, contentW, infoH, 2, 2, "FD");

  const infoLine = (label: string, value: string, row: number) => {
    const y = infoY + 10 + row * 10;
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...muted);
    pdf.setFontSize(9);
    pdf.text(label.toUpperCase(), infoX + 6, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...ink);
    pdf.setFontSize(11);
    pdf.text(value || "—", infoX + labelW, y);
    if (row < 3) {
      pdf.setDrawColor(235, 236, 238);
      pdf.setLineWidth(0.25);
      pdf.line(infoX + 5, y + 4, infoX + contentW - 5, y + 4);
    }
  };

  infoLine("Nom", nom, 0);
  infoLine("Prénom", prenom, 1);
  infoLine("Fonction", fonction, 2);
  infoLine("Matricule", String((worker as any)?.matricule || "—"), 3);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...ink);
  pdf.setFontSize(11);
  pdf.text("EST AUTORISE(E) A PRENDRE UN CONGE", margin, 166);

  pdf.setFillColor(...red);
  pdf.roundedRect(margin, 173, contentW, 21, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.text(`${daysWords} JOURS`, pageW / 2, 182, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`SOIT ${days} JOUR${days > 1 ? "S" : ""}`, pageW / 2, 189, { align: "center" });

  const detailY = 204;
  const detailRowH = 15;
  pdf.setDrawColor(218, 220, 224);
  pdf.setFillColor(...pale);
  pdf.roundedRect(margin, detailY, contentW, detailRowH * 2, 2, 2, "FD");
  pdf.line(margin, detailY + detailRowH, pageW - margin, detailY + detailRowH);

  const detailLine = (label: string, value: string, y: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...muted);
    pdf.setFontSize(9);
    pdf.text(label, margin + 6, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...ink);
    pdf.setFontSize(10.5);
    pdf.text(value, margin + 42, y);
  };

  detailLine("NATURE", nature, detailY + 10);
  detailLine("PERIODE", `DU ${fmtDateFR(conge.start_date)} AU ${fmtDateFR(conge.end_date)}`, detailY + detailRowH + 10);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...ink);
  pdf.setFontSize(10);
  pdf.text(`FAIT A OULED MOUSSA, LE ${todayStr}`, pageW - margin, 247, { align: "right" });

  pdf.setFontSize(10);
  pdf.text("L'INTERESSE(E)", margin + 29, 263, { align: "center" });
  pdf.text("SERVICE DU PERSONNEL", pageW - margin - 34, 263, { align: "center" });
  pdf.setDrawColor(...ink);
  pdf.setLineWidth(0.35);
  pdf.line(margin + 5, 280, margin + 53, 280);
  pdf.line(pageW - margin - 58, 280, pageW - margin - 10, 280);

  pdf.setDrawColor(224, 225, 228);
  pdf.line(margin, pageH - 12, pageW - margin, pageH - 12);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...muted);
  pdf.setFontSize(7.5);
  pdf.text("COPIES : INTERESSE(E) · GERANT DE L'ENTREPRISE · DOSSIER PERSONNEL", pageW / 2, pageH - 7, { align: "center" });

  const safeName = fullName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_") || "conge";
  pdf.save(`TITRE_DE_CONGE_${safeName}.pdf`);
}
