import type { Worker } from "@/lib/supabase-helpers";
import logoErcm from "@/assets/logo-ercm.png";
import ContractPreview from "./ContractPreview"

interface Props {
  type: "contract" | "bon_sortie" | "bon_entree" | "avertissement";
  worker: Worker;
  data: Record<string, string>;
  validationStatus?: {
    validated_by_responsible?: boolean;
    validated_by_rh?: boolean;
    responsible_validated_at?: string | null;
    rh_validated_at?: string | null;
  };
}

function DocHeader({ title, subtitle, reference }: { title: string; subtitle?: string; reference?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 8 }}>
        <img src={logoErcm} alt="ERCM SA" style={{ height: 72, objectFit: "contain" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#1a1a2e", margin: 0, letterSpacing: 2, lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 18, fontWeight: 700, color: "#ce161d", margin: "4px 0 0 0" }}>{subtitle}</p>}
          {reference && <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0 0" }}>Référence : {reference}</p>}
        </div>
      </div>
      <div style={{ borderTop: "3px solid #1a1a2e", marginTop: 12 }} />
    </div>
  );
}

function InfoGrid({ items }: { items: { label: string; value?: string | null }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", border: "1px solid #ddd", borderRadius: 4, overflow: "hidden", margin: "20px 0" }}>
      {items.map((item, i) => (
        <div key={i} style={{ padding: "10px 16px", borderBottom: i < items.length - 2 ? "1px solid #ddd" : "none", borderRight: i % 2 === 0 ? "1px solid #ddd" : "none", borderLeft: i % 2 === 0 ? "3px solid #ce161d" : "none" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#666", margin: 0, textTransform: "uppercase" }}>{item.label}</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", margin: "2px 0 0 0" }}>{item.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function VisaSection({ validationStatus }: { validationStatus?: Props["validationStatus"] }) {
  const responsableValidated = validationStatus?.validated_by_responsible;
  const rhValidated = validationStatus?.validated_by_rh;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 40 }}>
      <div style={{ border: "2px solid #1a1a2e", borderRadius: 4, padding: 20, minHeight: 100, position: "relative" }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e", margin: "0 0 24px 0", textTransform: "uppercase" }}>VISA CHEF DE SERVICE</p>
        {responsableValidated && (
          <div className="validation-stamp" style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%) rotate(-15deg)", border: "3px solid #22c55e", borderRadius: 8, padding: "4px 16px", color: "#22c55e", fontWeight: 800, fontSize: 18, opacity: 0.8 }}>
            VALIDÉ
          </div>
        )}
        <div style={{ borderTop: "1px solid #999", paddingTop: 6, marginTop: 20 }}>
          <p style={{ fontSize: 11, color: "#888", margin: 0, textAlign: "center" }}>Signature et Cachet</p>
        </div>
      </div>
      <div style={{ border: "2px solid #1a1a2e", borderRadius: 4, padding: 20, minHeight: 100, position: "relative" }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: "#1a1a2e", margin: "0 0 24px 0", textTransform: "uppercase" }}>VISA RH</p>
        {rhValidated && (
          <div className="validation-stamp" style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%) rotate(-15deg)", border: "3px solid #22c55e", borderRadius: 8, padding: "4px 16px", color: "#22c55e", fontWeight: 800, fontSize: 18, opacity: 0.8 }}>
            VALIDÉ
          </div>
        )}
        <div style={{ borderTop: "1px solid #999", paddingTop: 6, marginTop: 20 }}>
          <p style={{ fontSize: 11, color: "#888", margin: 0, textAlign: "center" }}>Signature et Cachet</p>
        </div>
      </div>
    </div>
  );
}

function DocFooter() {
  return (
    <p style={{ textAlign: "center", fontSize: 11, color: "#ce161d", marginTop: 30, fontStyle: "italic" }}>
      Document généré automatiquement — À conserver
    </p>
  );
}

function DocSignature({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 60, paddingTop: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ height: 60 }} />
        <p style={{ borderTop: "2px solid #1a1a2e", paddingTop: 8, minWidth: 200, fontSize: 13, fontWeight: 600 }}>{left}</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ height: 60 }} />
        <p style={{ borderTop: "2px solid #1a1a2e", paddingTop: 8, minWidth: 200, fontSize: 13, fontWeight: 600 }}>{right}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: "flex", marginBottom: 6, fontSize: 14 }}>
      <span style={{ minWidth: 200, fontWeight: 600, color: "#333" }}>{label} :</span>
      <span style={{ borderBottom: "1px dotted #bbb", flex: 1, paddingBottom: 2, color: "#1a1a2e" }}>{value || "—"}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, fontWeight: 700, color: "#ce161d", textTransform: "uppercase", letterSpacing: 1, marginTop: 20, marginBottom: 10, borderLeft: "3px solid #ce161d", paddingLeft: 10 }}>
      {children}
    </p>
  );
}

export default function DocumentPreview({ type, worker, data, validationStatus }: Props) {
  const today = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  const pageStyle: React.CSSProperties = {
    backgroundColor: "white",
    color: "#1a1a2e",
    padding: "40px 48px",
    maxWidth: 800,
    margin: "0 auto",
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 14,
    lineHeight: 1.8,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    borderRadius: 8,
  };

  const isBon = type === "bon_sortie" || type === "bon_entree";

  const sortieItems = [
    { label: "Matricule", value: (worker as any).matricule },
    { label: "Date de sortie", value: data.sortie_date },
    { label: "Nom Complet", value: worker.full_name },
    { label: "Heure de sortie", value: data.sortie_time },
    { label: "Poste", value: worker.position },
    { label: "Motif", value: data.reason },
    { label: "Département", value: worker.department },
  ];
  if (data.rentree_time) {
    sortieItems.push({ label: "Heure de rentrée", value: data.rentree_time });
  }

  const entreeItems = [
    { label: "Matricule", value: (worker as any).matricule },
    { label: "Date d'entrée", value: data.entree_date },
    { label: "Nom Complet", value: worker.full_name },
    { label: "Heure d'entrée", value: data.entree_time },
    { label: "Poste", value: worker.position },
    { label: "Motif", value: data.reason },
    { label: "Département", value: worker.department },
  ];

  const templates: Record<string, React.ReactNode> = {
    bon_sortie: (
      <div style={pageStyle}>
        <DocHeader title="BON D AUTORISATION" subtitle="Sortie" />
        <InfoGrid items={sortieItems} />
        <VisaSection validationStatus={validationStatus} />
        <DocFooter />
      </div>
    ),

    bon_entree: (
      <div style={pageStyle}>
        <DocHeader title="BON D AUTORISATION" subtitle="Entrée" />
        <InfoGrid items={entreeItems} />
        <VisaSection validationStatus={validationStatus} />
        <DocFooter />
      </div>
    ),

    contract: (
       <div id="document-preview">
          <ContractPreview worker={worker} data={data} lang='ar' logoDataUrl={data.logoDataUrl || logoErcm} />
        </div>
    ),

    avertissement: (
      <div style={pageStyle}>
        <DocHeader title="LETTRE D'AVERTISSEMENT" />
        <p style={{ textAlign: "right", fontSize: 13, color: "#666", marginBottom: 24 }}>Date : {data.avert_date || today}</p>

        <SectionTitle>Destinataire</SectionTitle>
        <Field label="Nom complet" value={worker.full_name} />
        <Field label="Poste" value={worker.position} />
        <Field label="Département" value={worker.department} />

        <SectionTitle>Objet : Avertissement</SectionTitle>
        <p style={{ fontSize: 13, color: "#444", marginBottom: 8 }}>
          Nous avons constaté le <strong>{data.infraction_date || "—"}</strong> l'infraction suivante :
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", padding: "10px 14px", backgroundColor: "#f8f8f8", border: "1px solid #eee", borderRadius: 4, marginBottom: 12 }}>
          {data.infraction || "—"}
        </p>
        {data.details && <p style={{ fontSize: 13, color: "#444", whiteSpace: "pre-wrap", marginBottom: 12 }}>{data.details}</p>}
        <p style={{ fontSize: 13, color: "#444" }}>
          Par la présente, nous vous adressons un avertissement formel. En cas de récidive, des sanctions plus sévères pourront être appliquées{data.sanctions ? ` : ${data.sanctions}` : "."}.
        </p>
        <p style={{ fontSize: 13, color: "#444", marginTop: 12 }}>
          Nous vous prions de prendre les mesures nécessaires pour éviter toute récidive.
        </p>

        <DocSignature left="La Direction" right="Employé(e)" />
        <DocFooter />
      </div>
    ),
  };

  return <>{templates[type]}</>;
}
