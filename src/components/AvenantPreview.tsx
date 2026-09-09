import type { Worker } from "@/lib/supabase-helpers";

export interface AvenantData {
  numAvenant: string;
  numContratRef: string;
  salBase: string;
  primeRisque: string;
  salPoste: string;
  primeTransport: string;
  primePanier: string;
  salNetFinal: string;
  dateSign: string;
  lieuSign: string;
}

export const EMPTY_AVENANT: AvenantData = {
  numAvenant: "01",
  numContratRef: "",
  salBase: "",
  primeRisque: "",
  salPoste: "",
  primeTransport: "2200.00",
  primePanier: "4400.00",
  salNetFinal: "",
  dateSign: "",
  lieuSign: "أولاد موسى",
};

interface Props {
  worker: Worker;
  avenant: AvenantData;
  contractData: Record<string, string>;
  logoDataUrl?: string;
}

function D({ value }: { value?: string | null }) {
  return (
    <span style={{ fontWeight: "bold", color: "#000", borderBottom: "1px dotted #000", padding: "0 5px", minWidth: 40, display: "inline-block" }}>
      {value || "................"}
    </span>
  );
}

export default function AvenantPreview({ worker, avenant, contractData, logoDataUrl }: Props) {
  const pageStyle: React.CSSProperties = {
    width: "210mm",
    minHeight: "297mm",
    background: "white",
    padding: "5mm",
    paddingTop: "0mm",
    fontFamily: "'Amiri', 'Times New Roman', serif",
    color: "black",
    lineHeight: 1.6,
    direction: "rtl",
    textAlign: "justify",
    fontSize: "12pt",
    boxShadow: "0 0 15px rgba(0,0,0,0.15)",
    margin: "0 auto",
  };
  const refNum = avenant.numContratRef || contractData.num_contrat;

  return (
    <div style={pageStyle}>
      {logoDataUrl && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <img src={logoDataUrl} alt="Logo" style={{ maxHeight: 80, display: "block", margin: "0 auto" }} />
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: 24, borderBottom: "2px solid black", paddingBottom: 8 }}>
        <p style={{ margin: 0, fontSize: "11pt" }}>Etude réalisation construction métallique salhi adel</p>
        <p style={{ fontWeight: "bold", fontSize: "20pt", margin: "10px 0", textDecoration: "underline", color: "#cc0000" }}>
          ملحق رقم <D value={avenant.numAvenant} /> لعقد العمل
        </p>
      </div>

      <p style={{ fontWeight: "bold", textDecoration: "underline", fontSize: "13pt", margin: "10px 0" }}>
        المراجع: ملحق لعقد العمل محدد المدة رقم <D value={refNum} />
      </p>

      <p style={{ fontWeight: "bold", margin: "10px 0" }}>بين الممضيين أسفله:</p>

      <div style={{ margin: "10px 0", padding: 10, border: "1px dashed #aaa" }}>
        <p style={{ fontWeight: "bold", textDecoration: "underline" }}>من جهة (المستخدم):</p>
        <p>السيد صالحي عادل صاحب مؤسسة دراسة و تركيب المنشئات المعدنية المسماة ERCMSA الكائن مقرها سيدي سالم شمال مجموعة 108 قسم رقم 2 اولاد موسى بومرداس.</p>
        <p style={{ fontWeight: "bold", textDecoration: "underline", marginTop: 12 }}>من جهة أخرى (العامل):</p>
        <p>السيد <D value={worker.full_name} /></p>
        <p>المولود في <D value={contractData.date_nais || worker.date_naissance} /> بـ : <D value={contractData.lieu_nais || worker.lieu_naissance} /> ولاية <D value={contractData.wilaya_nais} /></p>
      </div>

      <p style={{ fontWeight: "bold", marginTop: 12 }}>تم الاتفاق على ما يلي:</p>

      <p style={{ fontWeight: "bold", textDecoration: "underline", marginTop: 16, fontSize: "13pt" }}>موضوع الملحق</p>
      <p>يهدف هذا الملحق إلى تفصيل هيكل الأجر المنصوص عليه في المادة 06 من عقد العمل محدد المدة رقم <D value={refNum} />.</p>

      <p style={{ marginTop: 12 }}>يتكون الأجر الشهري للعامل وفقاً للتفصيل التالي:</p>
      <ul style={{ listStyle: "disc", paddingRight: 25, margin: "8px 0" }}>
        <li><b>الأجر القاعدي:</b> يحدد بمبلغ قدره <D value={avenant.salBase} /> دج.</li>
        <li><b>علاوة الخطر:</b> يستفيد العامل من منحة خطر شهرية تقدر بـ <D value={avenant.primeRisque} /> دج (أي بنسبة 10% من الأجر القاعدي).</li>
        <li><b>أجر المنصب:</b> وعليه يبلغ أجر المنصب الإجمالي مبلغا قدره <D value={avenant.salPoste} /> دج.</li>
        <li><b>التعويضات الملحقة:</b> يضاف إلى أجر المنصب تعويضات المصاريف المتمثلة في:
          <ul style={{ listStyle: "circle", paddingRight: 25 }}>
            <li><b>منحة النقل:</b> والمقدرة بـ <D value={avenant.primeTransport} /> دج شهرياً.</li>
            <li><b>منحة الإطعام (السلة):</b> والمقدرة بـ <D value={avenant.primePanier} /> دج شهرياً.</li>
          </ul>
        </li>
        <li><b>الأجر الصافي النهائي:</b> يتقاضى العامل بعد اقتطاع التزامات الضمان الاجتماعي والضريبة على الدخل الإجمالي (حسب القوانين السارية)، مبلغاً صافياً نهائياً قدره <D value={avenant.salNetFinal} /> دج.</li>
      </ul>

      <p style={{ fontWeight: "bold", textDecoration: "underline", marginTop: 16, fontSize: "13pt" }}>المادة 03: أحكام عامة</p>
      <p>تبقى جميع المواد والشروط الأخرى في عقد العمل الأصلي رقم <D value={refNum} /> دون تغيير وتستمر في إحداث كامل آثارها، وفقا لتشريع العمل المعمول به.</p>

      <p style={{ fontWeight: "bold", marginTop: 24 }}>
        حرر بـ : <D value={avenant.lieuSign} /> في <D value={avenant.dateSign} />
      </p>
      <p style={{ textAlign: "center", fontWeight: "bold" }}>(حرر في نسختين أصليتين، تسلم نسخة للعامل وتحفظ نسخة في ملفه)</p>

      <div style={{ marginTop: 50, display: "flex", justifyContent: "space-between", padding: "0 20px", pageBreakInside: "avoid" }}>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div style={{ fontWeight: "bold", fontSize: "14pt", marginBottom: 60, textDecoration: "underline" }}>المستخدم (الطرف الأول)</div>
        </div>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div style={{ fontWeight: "bold", fontSize: "14pt", marginBottom: 10, textDecoration: "underline" }}>العامل (الطرف الثاني)</div>
          <div>قرأ و صودق عليه</div>
        </div>
      </div>
    </div>
  );
}
