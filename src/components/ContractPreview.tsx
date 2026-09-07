import type { Worker } from "@/lib/supabase-helpers";
import { dureeArabic, dureeFr } from "@/lib/contract-helpers";

interface Props {
  worker: Worker;
  data: Record<string, string>;
  lang?: "ar" | "fr";
  logoDataUrl?: string;
}

function D({ value }: { value?: string | null }) {
  return (
    <span style={{ fontWeight: "bold", color: "#000", borderBottom: "1px dotted #000", padding: "0 5px", minWidth: 40, display: "inline-block" }}>
      {value || "................"}
    </span>
  );
}

function Article({ title, children, lang }: { title: string; children: React.ReactNode; lang: "ar" | "fr" }) {
  return (
    <div style={{ marginBottom: lang === "ar" ? 15 : 12 }}>
      <span style={{ fontWeight: "bold", fontSize: lang === "ar" ? "14pt" : "12pt", textDecoration: "underline", marginBottom: 5, display: "block" }}>{title}</span>
      <div style={{ fontSize: lang === "ar" ? "12pt" : "11pt" }}>{children}</div>
    </div>
  );
}

export default function ContractPreview({ worker, data, lang = "ar", logoDataUrl }: Props) {
  const dureeMois = parseInt(data.duree_mois || "12", 10) || 12;
  const periodeEssai = data.periode_essai !== "false";
  const isAr = lang === "ar";

  const pageStyle: React.CSSProperties = {
    width: "210mm",
    minHeight: "297mm",
    background: "white",
    padding: "10mm",
    fontFamily: isAr ? "'Amiri', 'Times New Roman', serif" : "'Times New Roman', serif",
    color: "black",
    lineHeight: isAr ? 1.6 : 1.5,
    direction: isAr ? "rtl" : "ltr",
    textAlign: "justify",
    fontSize: isAr ? "12pt" : "11pt",
    boxShadow: "0 0 15px rgba(0,0,0,0.15)",
    margin: "0 auto",
  };

  return (
    <div style={pageStyle}>
      {/* Logo */}
      {logoDataUrl && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <img src={logoDataUrl} alt="Logo" style={{ maxHeight: 80, display: "block", margin: "0 auto" }} />
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: isAr ? 30 : 24, borderBottom: "2px solid black", paddingBottom: 8 }}>
        <p style={{ margin: 0, fontSize: "11pt" }}>Etude réalisation construction métallique salhi adel</p>
        <p style={{ fontWeight: "bold", fontSize: "20pt", margin: "10px 0", textDecoration: "underline" }}>
          {isAr ? "عقد عمل لمدة محددة" : "CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE"}
        </p>
        <p style={{ fontSize: "12pt", fontWeight: "bold" }}>
          {isAr ? "رقم: " : "N° : "}<D value={data.num_contrat} />/
        </p>
      </div>

      {/* Préambule */}
      {isAr ? (
        <div style={{ fontSize: "11pt", marginBottom: 15, lineHeight: 1.4 }}>
          <p style={{ margin: "2px 0" }}>بمقتضى القانون رقم 90/11 المؤرخ في 21/04/90 المتعلق بعلاقات العمل المتمم و المعدل.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى القانون رقم 91/29 المؤرخ في 21/12/91 المعدل و المتمم للقانون 90/11 المذكور أعلاه.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى الأمر رقم 96/21 المؤرخ في 09/06/96 المعدل و المتمم للقانون 90/11 المذكور أعلاه.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى الأمر رقم 90/04 المؤرخ في 06/04/90 المتعلق بتسوية النزاعات الفردية المعدل و المتمم بالأمر رقم 91/28 المؤرخ في21/12/91 .</p>
          <p style={{ margin: "2px 0" }}>بمقتضى الامر 97-03 المؤرخ في 11 يناير سنة 1997 يحدد المدة القانونية للعمل.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى المرسوم التنفيذي رقم 59-15 المـؤرخ في 18 ربــيع الــثـاني عام 1436 المـوافـق 8 فبـرايـر سـنة 2015 الــذي يحدد العناصر المكونة للأجر الوطني الأدنى المضمون.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى المرسوم التنـفيذي رقم 15 -177- المؤرخ في 19 رمـضان عام 1436 الموافق 6 يــولـــيــو ســنــة 2015 الذي يــتــمـم المرسوم الــتـنــفــيــذي رقم 59-15 المذكور اعلاه.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى المرسوم الرئاسي رقم 26-01 المؤرخ في 18 رجب عام 1447 الموافق 07 جانفي سنة 2026، الذي يحدد الأجر الوطني الأدنى المضمون.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى المرسوم التنفيذي 63-278 المؤرخ في 26 يوليو 1963 الذي يحدد قائمة الاعياد الرسمية المعدل و المتمم بالقانون رقم 18-12 ا المرخ في 2 يوليو سنة 2018 المعدل و المتمم بالقانون 23/10 المؤرخ 26 يونيو 2023.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى القانون 23-08 الموافق ل 21 يونيو 2023 يتعلق بالوقاية من النزعات الجماعية للعمل وتسويتها و ممارسة حق الاضراب.</p>
          <p style={{ margin: "2px 0" }}>بمقتضى القيد في المركز الوطني لسجل التجاري لولاية بومرداس شخص طبيعي " صالحي عادل" رقم 17 أ 3674152-00/35 بتاريخ 08/03/2022.</p>
        </div>
      ) : (
        <div style={{ fontSize: "10pt", marginBottom: 15, lineHeight: 1.4 }}>
          <p style={{ margin: "2px 0" }}>Vu la loi n° 90/11 du 21/04/90 relative aux relations de travail, modifiée et complétée.</p>
          <p style={{ margin: "2px 0" }}>Vu la loi n° 91/29 du 21/12/91 modifiant et complétant la loi 90/11 susmentionnée.</p>
          <p style={{ margin: "2px 0" }}>Vu l'ordonnance n° 96/21 du 09/06/96 modifiant et complétant la loi 90/11 susmentionnée.</p>
          <p style={{ margin: "2px 0" }}>Vu la loi n° 90/04 du 06/04/90 relative au règlement des conflits individuels, modifiée et complétée par l'ordonnance n° 91/28 du 21/12/91.</p>
          <p style={{ margin: "2px 0" }}>Vu l'ordonnance 97-03 du 11 janvier 1997 fixant la durée légale du travail.</p>
          <p style={{ margin: "2px 0" }}>Vu le décret exécutif n° 15-59 du 8 février 2015 fixant les éléments constitutifs du salaire national minimum garanti.</p>
          <p style={{ margin: "2px 0" }}>Vu le décret exécutif n° 15-177 du 6 juillet 2015 complétant le décret 15-59 susmentionné.</p>
          <p style={{ margin: "2px 0" }}>Vu le décret présidentiel n° 26-01 du 07 janvier 2026 fixant le salaire national minimum garanti.</p>
          <p style={{ margin: "2px 0" }}>Vu le décret exécutif 63-278 du 26 juillet 1963 fixant la liste des fêtes légales, modifié et complété par la loi n° 18-12 du 2 juillet 2018 et la loi 23/10 du 26 juin 2023.</p>
          <p style={{ margin: "2px 0" }}>Vu la loi 23-08 du 21 juin 2023 relative à la prévention et au règlement des conflits collectifs de travail et à l'exercice du droit de grève.</p>
          <p style={{ margin: "2px 0" }}>Vu l'inscription au Registre du Commerce de la wilaya de Boumerdes, personne physique « SALHI ADEL » n° 17 A 3674152-00/35 du 08/03/2022.</p>
        </div>
      )}

      <div style={{ textAlign: "center", margin: "20px 0", fontWeight: "bold", fontSize: isAr ? "16pt" : "14pt", textDecoration: "underline" }}>
        {isAr ? "أبـــــــــرم هذا العقــــــــــــــــــــــد ما بين" : "IL A ÉTÉ CONVENU CE QUI SUIT ENTRE"}
      </div>

      {/* Parties */}
      <div style={{ margin: "20px 0", backgroundColor: "#f9f9f9", padding: 15, border: "1px dashed #aaa", fontSize: isAr ? "12pt" : "11pt" }}>
        <span style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: 5, display: "block" }}>
          {isAr ? "من جهـــــــــة:" : "D'une part :"}
        </span>
        {isAr ? (
          <>
            السيد : <strong>صالحي عادل</strong> صاحب مؤسسة دراسة و تركيب المنشئات المعدنية المسماة <strong>ERCMSA</strong> الكائن مقرها سيدي سالم شمال مجموعة 108 قسم رقم 2 اولاد موسى بومرداس.<br />
            الهاتف: 0550575833 . الإمايل : ercmsalhi.com@gmail.com<br />
            رقم الضمان الإجتماعي للمستخدم : 3537638638
          </>
        ) : (
          <>
            Monsieur SALHI ADEL, propriétaire de l'entreprise d'étude et de réalisation de constructions métalliques dénommée ERCMSA, dont le siège est situé à Sidi Salem Nord groupe 108 section n° 2, Ouled Moussa, Boumerdes.<br />
            Tél : 0550575833 — Email : ercmsalhi.com@gmail.com<br />
            N° de sécurité sociale employeur : 3537638638
          </>
        )}
      </div>

      <div style={{ margin: "20px 0", backgroundColor: "#f9f9f9", padding: 15, border: "1px dashed #aaa", fontSize: isAr ? "12pt" : "11pt" }}>
        <span style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: 5, display: "block" }}>
          {isAr ? "من جهــــــــة اخرى:" : "D'autre part :"}
        </span>
        {isAr ? (
          <>
            و السيد <D value={worker.full_name} /><br />
            المولود في: <D value={data.date_nais || worker.date_naissance} /> بـ : <D value={data.lieu_nais || worker.lieu_naissance} /> ولاية <D value={data.wilaya_nais} /><br />
            الحامل لبطاقة التعريف البيومترية رقم <D value={data.cni} /> الصادرة في <D value={data.date_cni} /> عن بلدية: <D value={data.commune_cni} /> ولاية <D value={data.wilaya_cni} /><br />
            الساكن بـ <D value={data.adresse || worker.address} /> ولاية <D value={data.wilaya_adr} /><br />
            طبقا لبطاقة الاقامة المؤرخة في: <D value={data.date_res} /><br />
            الهاتف : <D value={data.tel || worker.phone} /> الإمايل : <D value={data.email} />
          </>
        ) : (
          <>
            Monsieur <D value={worker.full_name} /><br />
            Né(e) le : <D value={data.date_nais || worker.date_naissance} /> à : <D value={data.lieu_nais || worker.lieu_naissance} /> wilaya de <D value={data.wilaya_nais} /><br />
            Titulaire de la carte d'identité biométrique n° <D value={data.cni} /> délivrée le <D value={data.date_cni} /> par la commune de <D value={data.commune_cni} /> wilaya de <D value={data.wilaya_cni} /><br />
            Demeurant à <D value={data.adresse || worker.address} /> wilaya de <D value={data.wilaya_adr} /><br />
            Selon le certificat de résidence du : <D value={data.date_res} /><br />
            Tél : <D value={data.tel || worker.phone} /> — Email : <D value={data.email} />
          </>
        )}
      </div>

      <div style={{ textAlign: "center", margin: "20px 0", fontWeight: "bold", fontSize: isAr ? "16pt" : "14pt", textDecoration: "underline" }}>
        {isAr ? "تم الاتفــــــــــــــــــــــــــــــــاق على ما يلي" : "IL A ÉTÉ CONVENU CE QUI SUIT"}
      </div>

      {isAr ? (
        <>
          <Article lang="ar" title="المادة 01: موضوع العقد">
            يحدد هذا العقد القواعد والشروط التي بموجبها انعقدت علاقة العمل المحددة المدة بالتوقيت الكامل بين الطرفين.
          </Article>
          <Article lang="ar" title="المادة 02 : غاية العقد">
            يوظف: السيد <D value={worker.full_name} /> بعقد محدد المدة بالتوقيت الكامل<br />
            في منصب : <D value={data.poste || worker.position} />
          </Article>
          <Article lang="ar" title="المادة 03 : مدة العقد و سببه.">
            طبقا لنص المادة 12 من قانون العمل 90-11 المعدل و المتمم بالامر 96-21 فان هذا العقد تم إبرامه بمدة محددة بالتوقيت الكامل وذالك لان تقوم بانجاز أشغال ذات مدة محددة على اساس القيام ببناء مستودعات ( اشغال مقاولاتية) منشئات معدنيـــــــة.<br />
            ولهذا السبب ابرم هذا العقد لمدة : {dureeArabic(dureeMois)}.<br />
            يبدأ هذا العقد من يوم <D value={data.date_debut} /> ينتهي هذا العقد يوم <D value={data.date_fin} />
          </Article>
          <Article lang="ar" title="المادة 04: المدة التجريبية">
            {periodeEssai
              ? "يخضع المعني لمدة تجريبية قدرها (03) ثلاثة أشهر سارية المفعول ابتداءا من تاريخ ابرام العقد، وخلال الفترة التجريبية المحددة أعلاه يمكن لأي الطرفين فسخ هذا العقد وإنهاء علاقة العمل دون تعويض أو إشعار مسبق."
              : "لا يخضع المعني لمدة تجريبية (وذلك لتجديد العقد).."}
          </Article>
          <Article lang="ar" title="المادة 05 :مواقيت العمل">
            يقوم الطرف الثاني بمهامه المنوطة إليه في المواقيت المحددة قانونا.<br />
            المدة القانونية للعمل أربعون (40) ساعة في الأسبوع .<br />
            تتوزع هذه الساعات على خمسة أيام كاملة .<br />
            يستفيد العامل بيومين راحة في الاسبوع – الخميس و الجمعة -<br />
            على العامل احترام مواقيت العمل و الانضباط.<br />
            في حالة الغياب؛ على العامل إخطار المستخدم في اليوم ذاته مبررا غيابه بشهادة طبية مؤشر عليها من طرف صندوق الضمان الاجتماعي أو أي وثيقة أخرى داعمة و إذا تعذر ذلك يرسل تبريره في ظرف 48 ساعة؛<br />
            و خلاف ذلك يتم أعذاره بواسطة رسالة مضمنة الوصول بالعنوان المصرح به من طرف العامل في (شهادة الإقامة) الموجودة بالملف و إذا لم يلتحق بالمنصب خلال 48 ساعة يتم ارسال اعذار ثاني واذ ظل غيابه مستمر و غير مبررخلال 48 ساعة بعد الاعذارالثاني يعتبر العامل متخليا على المنصب .
          </Article>
          <Article lang="ar" title="المادة 06: الأجر">
            يتلقى المتعاقد مقابل العمل المنجز أجرا يتوافق مع شبكة الأجور المعمول بها في المؤسسة ٬ يقتطع من هذا الأجر المستحقات الجبائية و الضمان الاجتماعي طبقا للقوانين المعمول بها في هذا الشأن , ولا يمكن للعامل ان يطالب بما لم يتفق عليه الطرفين.<br />
            الاجر القاعدي : <D value={data.sal_base} /> دج، الاجر الصافي <D value={data.sal_net} /> دج.
          </Article>
          <Article lang="ar" title="المادة 07:تعويض العطلة السنوية">
            يستفيد الطرف الثاني ( العامل) من عطلة سنوية مدفوعة الأجر˛ من قبل الصندوق الوطني للعطل المدفوعة الأجر و البطالة الناجمة عن سوء الأحوال الجوية (CACOBATPH).<br />
            عملا بأحكام القانون 52 المكرر و 52 مكرر 1 من القانون 90/11.
          </Article>
          <Article lang="ar" title="المادة 08:السر المهني">
            يجب على الطرف الثاني ممارسة نشاطه المهني حسب قواعد المهنة ليبقى في خدمة صاحب العمل˛ و عليه أن يحفظ السر المهني أثناء و بعد فترة العقد.
          </Article>
          <Article lang="ar" title="المادة 09: احترام الالتزامات">
            يلتزم الطرفان المتعاقدان باحترام مضمون هذا العقد إلى جانب .<br />
            احترام النظام الداخلي.<br />
            احترام قواعد حفظ الصحة و الامن.<br />
            للعامل الحق في الحماية الاجتماعية لدى هيئات الضمان الاجتماعي.<br />
            و العمل في اي مكان يطلب منــــــــــــــــه .
          </Article>
          <Article lang="ar" title="المادة 10: انتهاء العقد ( علاقة العمل)">
            ينتهي هذا العقد لإحدى الحالات المنصوص عليها في المادة 66 من القانون 90/11 الخاص بعلاقة العمل.<br />
            وفي جميع الحالات الأخرى، يحتفظ العامل في هذا العقد بخيار إنهاء علاقة العمل، من خلال اتفاق متبادل صريح، مع مراعاة تقديم إشعار مدته ثلاثين (30) يومًا.
          </Article>
          <Article lang="ar" title="المادة 11: حالة توقف النشاط">
            في حالة توقف النشاط كليا أو جزئيا و بسبب إما التمويل أو التقلبات الجوية أو بسبب قوة قاهرة فان المؤسسة تتوقف عن دفع الراتب٬ و في حالة عدم استئناف النشاط بعد زوال تلك الأسباب فان العقد يفسخ حالا دون تعويض و دون إشعار مسبق.
          </Article>
          <Article lang="ar" title="المادة 12: حقوق و واجبات المتعاقد">
            تطبق على المتعاقد أحكام القانون 90/11 المؤرخ في 21/04/1990 المتعلق بعلاقات العمل المعدل و المتمم ˛ فيما يخص الحقوق و الواجبات .
          </Article>
          <Article lang="ar" title="المادة 13:تسوية النزاعات">
            كل نزاع يمكن أن يحدث بين طرفي هذا العقد بسبب تنفيذ أحكامه تتم تسويته بالتراضي بين الطرفين.<br />
            في حالة عدم التواصل إلى حل يستوجب إتباع إجراءات التسوية حسب أحكام القانون الداخلي و الإجراءات المحددة في التشريع و النظام الخاص و لا سيما المادة 4 من القانون 90/04 المؤرخ في 06/06/90) المعدل و المتمم.<br />
            و في حالة استنفاذ الاجراءات الداخلية لنزعات العمل الفردية داخل الهيئة يمكن للعامل حسب المادة 5 من القانون المذكور اعلاه اخطار مفتش العمل وفقا للإجراءات التي يحددها القانون.<br />
            محكمة الاختصاص محكمة خميس الخشنة.
          </Article>
          <Article lang="ar" title="المادة 14:بند موافقة صريحة بمعالجة البيانات الشخصية.">
            أقرر بموافقتي على معالجة بياناتي الشخصية من قبل صاحب مؤسسة تركيب المنشأت المعدنية المسمات ERCMSA SALHI ADEL الكائن مقرها سيدي سالم 108 شمال رقم 02 أولاد موسى ولاية بومرداس، طبقا لمقتضيات القانون 18-07 المؤرخ في 10 جوان 2018 والمتعلق بحماية الأشخاص الطبيعين في مجال معالجة المعطيات ذات الطابع الشخصي.
          </Article>
          <Article lang="ar" title="المادة 15:دخول العقد حيز التنفيذ">
            يدخل هذا العقد حيز التنفيذ بمجرد التوقيع عليه من الطرفين.<br />
            يوقع ويبصم العامل في الأول و يلي توقيعه عبارة " قرأ و صودق عليه"<br />
            - هذا العقد يحرر في(2) نسختين (يسلم نسخة من العقد لطرف الثاني و تحفظ نسخة في ملف العامل مع تأشير على صفحات ثلاثة للعقد و امضاء و بصمة الطرف الثاني على ادنى الصفحات الثلاث)<br />
            - تحتوي كل نسخة على ثلاثة صفحات .<br />
            - يتضمن العقد (15) خمسة عشرة مادة.
          </Article>
        </>
      ) : (
        <>
          <Article lang="fr" title="Article 01 : Objet du contrat">
            Le présent contrat fixe les règles et conditions selon lesquelles s'établit la relation de travail à durée déterminée à temps plein entre les deux parties.
          </Article>
          <Article lang="fr" title="Article 02 : But du contrat">
            Monsieur <D value={worker.full_name} /> est engagé par contrat à durée déterminée à temps plein<br />
            au poste de : <D value={data.poste || worker.position} />
          </Article>
          <Article lang="fr" title="Article 03 : Durée du contrat et motif">
            Conformément à l'article 12 de la loi 90-11 modifiée et complétée par l'ordonnance 96-21, le présent contrat est conclu pour une durée déterminée à temps plein, en vue de la réalisation de travaux à durée limitée portant sur la construction d'entrepôts (travaux d'entreprise) et de constructions métalliques.<br />
            Pour cette raison, le présent contrat est conclu pour une durée de : {dureeFr(dureeMois)}.<br />
            Il prend effet le <D value={data.date_debut} /> et prend fin le <D value={data.date_fin} />
          </Article>
          <Article lang="fr" title="Article 04 : Période d'essai">
            {periodeEssai
              ? "Le concerné est soumis à une période d'essai de trois (03) mois à compter de la date de conclusion du contrat. Pendant cette période, chacune des parties peut résilier le contrat sans indemnité ni préavis."
              : "Le concerné n'est pas soumis à une période d'essai (renouvellement de contrat)."}
          </Article>
          <Article lang="fr" title="Article 05 : Horaires de travail">
            Le second contractant exerce ses fonctions selon les horaires fixés par la loi.<br />
            La durée légale du travail est de quarante (40) heures par semaine.<br />
            Réparties sur cinq jours pleins.<br />
            Le travailleur bénéficie de deux jours de repos par semaine — jeudi et vendredi.<br />
            Le travailleur doit respecter les horaires et la discipline.<br />
            En cas d'absence, le travailleur doit informer l'employeur le jour même en justifiant son absence par un certificat médical visé par la sécurité sociale ou tout autre document, faute de quoi il dispose de 48 heures pour transmettre son justificatif.<br />
            À défaut, une mise en demeure lui sera adressée par courrier recommandé. Si le travailleur ne reprend pas son poste dans les 48 heures, une seconde mise en demeure sera émise. En cas de persistance d'absence injustifiée 48 heures après celle-ci, le travailleur sera considéré comme ayant abandonné son poste.
          </Article>
          <Article lang="fr" title="Article 06 : Salaire">
            Le contractant perçoit, en contrepartie du travail accompli, une rémunération conforme à la grille des salaires en vigueur au sein de l'entreprise. Sont retenues les cotisations fiscales et de sécurité sociale conformément à la législation en vigueur.<br />
            Salaire de base : <D value={data.sal_base} /> DA, Salaire net : <D value={data.sal_net} /> DA.
          </Article>
          <Article lang="fr" title="Article 07 : Indemnité de congé annuel">
            Le second contractant bénéficie d'un congé annuel payé par la Caisse Nationale des Congés Payés et du Chômage Intempéries (CACOBATPH).<br />
            Conformément aux articles 52 bis et 52 bis 1 de la loi 90/11.
          </Article>
          <Article lang="fr" title="Article 08 : Secret professionnel">
            Le second contractant doit exercer son activité professionnelle selon les règles de l'art et préserver le secret professionnel pendant et après la période du contrat.
          </Article>
          <Article lang="fr" title="Article 09 : Respect des engagements">
            Les deux parties s'engagent à respecter le contenu du présent contrat.<br />
            Respect du règlement intérieur.<br />
            Respect des règles d'hygiène et de sécurité.<br />
            Le travailleur a droit à la protection sociale auprès des organismes de sécurité sociale.<br />
            Et de travailler en tout lieu requis.
          </Article>
          <Article lang="fr" title="Article 10 : Fin du contrat (relation de travail)">
            Ce contrat prend fin dans l'un des cas prévus par l'article 66 de la loi 90/11 relative à la relation de travail.<br />
            Dans tous les autres cas, le travailleur conserve la faculté de mettre fin à la relation de travail par accord mutuel exprès, sous réserve d'un préavis de trente (30) jours.
          </Article>
          <Article lang="fr" title="Article 11 : Cessation d'activité">
            En cas d'arrêt total ou partiel de l'activité, dû soit au financement, aux intempéries ou à un cas de force majeure, l'entreprise cesse le paiement du salaire. À défaut de reprise après disparition de ces causes, le contrat sera résilié de plein droit sans indemnité ni préavis.
          </Article>
          <Article lang="fr" title="Article 12 : Droits et obligations du contractant">
            S'appliquent au contractant les dispositions de la loi 90/11 du 21/04/1990 relative aux relations de travail, modifiée et complétée, en ce qui concerne les droits et obligations.
          </Article>
          <Article lang="fr" title="Article 13 : Règlement des litiges">
            Tout litige pouvant survenir entre les parties au sujet de l'exécution du présent contrat sera réglé à l'amiable.<br />
            À défaut, il sera fait application des procédures prévues par le règlement intérieur et la législation, notamment l'article 4 de la loi 90/04 du 06/06/90 modifiée et complétée.<br />
            En cas d'épuisement des procédures internes, le travailleur peut, conformément à l'article 5 de la loi susmentionnée, saisir l'inspection du travail.<br />
            Tribunal compétent : Tribunal de Khemis El Khechna.
          </Article>
          <Article lang="fr" title="Article 14 : Consentement au traitement des données personnelles">
            Je consens au traitement de mes données personnelles par l'entreprise ERCMSA SALHI ADEL, sise à Sidi Salem 108 Nord n° 02, Ouled Moussa, wilaya de Boumerdes, conformément à la loi 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.
          </Article>
          <Article lang="fr" title="Article 15 : Entrée en vigueur">
            Le présent contrat entre en vigueur dès sa signature par les deux parties.<br />
            Le travailleur signe et appose son empreinte en premier, suivi de la mention « lu et approuvé ».<br />
            Le présent contrat est établi en deux (2) exemplaires (un exemplaire est remis au second contractant et un exemplaire conservé dans le dossier du travailleur).<br />
            Chaque exemplaire comporte trois pages.<br />
            Le contrat comporte quinze (15) articles.
          </Article>
        </>
      )}

      {/* Lieu et date */}
      <div style={{ marginTop: 30, fontSize: "12pt", fontWeight: "bold" }}>
        {isAr ? <>حرر ب : <D value={data.lieu_sign || "أولاد موسى"} /> في <D value={data.date_sign} /></> : <>Fait à : <D value={data.lieu_sign || "Ouled Moussa"} /> le <D value={data.date_sign} /></>}
      </div>

      {/* Signatures */}
      <div style={{ marginTop: 50, display: "flex", justifyContent: "space-between", padding: "0 20px", pageBreakInside: "avoid" }}>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div style={{ fontWeight: "bold", fontSize: "14pt", marginBottom: 60, textDecoration: "underline" }}>
            {isAr ? "المستخدم ( الطرف الأول)" : "L'employeur (Première partie)"}
          </div>
        </div>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div style={{ fontWeight: "bold", fontSize: "14pt", marginBottom: 10, textDecoration: "underline" }}>
            {isAr ? "العامل (الطرف الثاني)" : "Le travailleur (Seconde partie)"}
          </div>
          <div>{isAr ? "قرأ و صودق عليه" : "Lu et approuvé"}</div>
        </div>
      </div>
    </div>
  );
}
