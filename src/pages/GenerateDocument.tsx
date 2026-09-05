import { DateInput } from "@/components/ui/date-input";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkers, createDocument, updateDocument, createWorker, DOCUMENT_TYPES } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { exportToPdf } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WorkerAutocomplete from "@/components/WorkerAutocomplete";
import { Download, Save, Printer, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import DocumentPreview from "@/components/DocumentPreview";
import ContractPreview from "@/components/ContractPreview";
import AvenantPreview, { AvenantData, EMPTY_AVENANT } from "@/components/AvenantPreview";
import { WILAYAS_DATA, getCommunesByWilaya } from "@/data/wilayas";
import { DUREE_OPTIONS, dureeArabicLabel, computeContractEnd } from "@/lib/contract-helpers";
import ContractsImportExport from "@/components/ContractsImportExport";
import defaultLogo from "@/assets/logo-ercm.png";

type DocType = keyof typeof DOCUMENT_TYPES;

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

const getDefaultValues = (docType: DocType): Record<string, string> => {
  const year = new Date().getFullYear();
  switch (docType) {
    case "contract":
      return {
        num_contrat: `001/${year}`,
        date_debut: todayStr(),
        duree_mois: "12",
        date_fin: computeContractEnd(todayStr(), 12),
        date_sign: todayStr(),
        lieu_sign: "أولاد موسى",
        periode_essai: "true",
      };
    case "bon_sortie":
      return { sortie_date: todayStr(), sortie_time: nowTime() };
    case "avertissement":
      return { avert_date: todayStr(), infraction_date: todayStr() };
    default:
      return {};
  }
};

const formFieldsByType: Record<DocType, { key: string; label: string; type?: string; placeholder?: string }[]> = {
  contract: [], // handled separately
  bon_sortie: [
    { key: "sortie_date", label: "Date de sortie", type: "date" },
    { key: "sortie_time", label: "Heure de sortie", type: "time" },
    { key: "reason", label: "Motif de sortie", placeholder: "Ex: Rendez-vous médical" },
  ],
  avertissement: [
    { key: "avert_date", label: "Date de l'avertissement", type: "date" },
    { key: "infraction", label: "Nature de l'infraction", placeholder: "Ex: Retard répété" },
    { key: "infraction_date", label: "Date de l'infraction", type: "date" },
    { key: "details", label: "Détails de l'infraction", type: "textarea", placeholder: "Décrivez l'infraction en détail..." },
    { key: "sanctions", label: "Sanctions prévues", placeholder: "Ex: Mise en garde" },
  ],
};

function WilayaSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11"><SelectValue placeholder="--- إختر ولاية ---" /></SelectTrigger>
        <SelectContent className="max-h-60">
          {WILAYAS_DATA.map((w) => (
            <SelectItem key={w.code} value={w.nom_ar}>{w.code} - {w.nom_ar} ({w.nom_fr})</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CommuneSelect({ wilayaAr, value, onChange, label }: { wilayaAr: string; value: string; onChange: (v: string) => void; label: string }) {
  const communes = useMemo(() => getCommunesByWilaya(wilayaAr), [wilayaAr]);
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={!wilayaAr}>
        <SelectTrigger className="h-11"><SelectValue placeholder="--- إختر بلدية ---" /></SelectTrigger>
        <SelectContent className="max-h-60">
          {communes.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/50 border-r-4 border-destructive px-3 py-2 font-bold text-sm text-foreground">
      {children}
    </div>
  );
}

function ContractForm({ formData, setFormData, worker }: {
  formData: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  worker: any;
}) {
  const set = (key: string) => (val: string) => setFormData(p => ({ ...p, [key]: val }));
  const inp = (key: string, label: string, opts?: { type?: string; placeholder?: string }) => (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      {opts?.type === "date" ? (
        <DateInput
          value={formData[key] ?? ""}
          onChange={(e) => set(key)(e.target.value)}
          className="h-11"
        />
      ) : (
        <Input
          type={opts?.type ?? "text"}
          value={formData[key] ?? ""}
          onChange={(e) => set(key)(e.target.value)}
          placeholder={opts?.placeholder}
          className="h-11"
        />
      )}
    </div>
  );

  // Auto-fill from worker data
  useEffect(() => {
    if (worker) {
      setFormData(p => ({
        ...p,
        date_nais: p.date_nais || worker.date_naissance || "",
        lieu_nais: p.lieu_nais || worker.lieu_naissance || "",
        adresse: p.adresse || worker.address || "",
        tel: p.tel || worker.phone || "",
        poste: p.poste || worker.position || "",
      }));
    }
  }, [worker?.id]);

  // Auto-calculate end date when start date or duration changes
  useEffect(() => {
    const m = parseInt(formData.duree_mois || "12", 10) || 12;
    if (formData.date_debut) {
      const end = computeContractEnd(formData.date_debut, m);
      setFormData(p => (p.date_fin === end ? p : { ...p, date_fin: end }));
    }
  }, [formData.date_debut, formData.duree_mois]);

  return (
    <div className="space-y-4">
      <SectionHeader>1. معلومات العقد (Informations Contrat)</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {inp("num_contrat", "رقم العقد (N° Contrat)", { placeholder: "ex: 007/2024" })}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">مدة العقد (Durée)</Label>
          <Select value={formData.duree_mois ?? "12"} onValueChange={set("duree_mois")}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DUREE_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>{dureeArabicLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {inp("date_debut", "تاريخ بداية العقد (Date Début)", { type: "date" })}
        {inp("date_fin", "تاريخ نهاية العقد (Date Fin)", { type: "date" })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {inp("poste", "المنصب (Poste)", { placeholder: "المنصب" })}
        {inp("lieu_sign", "مكان التحرير (Lieu de signature)", { placeholder: "أولاد موسى" })}
        {inp("date_sign", "تاريخ التحرير (Date de signature)", { type: "date" })}
      </div>
      <label className="flex items-center gap-3 cursor-pointer p-3 border border-input rounded-md bg-muted/30 hover:bg-accent/30 transition-colors">
        <Checkbox
          checked={formData.periode_essai !== "false"}
          onCheckedChange={(v) => set("periode_essai")(v ? "true" : "false")}
        />
        <span className="font-semibold text-sm">
          تطبيق المدة التجريبية (3 أشهر) — Appliquer la période d'essai (3 mois)
        </span>
      </label>

      <SectionHeader>2. معلومات العامل (Informations Salarié)</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {inp("date_nais", "تاريخ الميلاد (Date Naissance)", { type: "date" })}
        <WilayaSelect label="ولاية الميلاد (Wilaya Naissance)" value={formData.wilaya_nais ?? ""} onChange={set("wilaya_nais")} />
        <CommuneSelect label="مكان الميلاد (Lieu Naissance)" wilayaAr={formData.wilaya_nais ?? ""} value={formData.lieu_nais ?? ""} onChange={set("lieu_nais")} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {inp("cni", "رقم ب.ت.و (N° CNI Biométrique)")}
        {inp("date_cni", "تاريخ الصدور (Date Délivrance)", { type: "date" })}
        <WilayaSelect label="ولاية الإصدار (Wilaya CNI)" value={formData.wilaya_cni ?? ""} onChange={set("wilaya_cni")} />
        <CommuneSelect label="بلدية الإصدار (Commune CNI)" wilayaAr={formData.wilaya_cni ?? ""} value={formData.commune_cni ?? ""} onChange={set("commune_cni")} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {inp("adresse", "العنوان (Adresse)")}
        <WilayaSelect label="ولاية الإقامة (Wilaya Adresse)" value={formData.wilaya_adr ?? ""} onChange={set("wilaya_adr")} />
        {inp("date_res", "تاريخ بطاقة الإقامة (Date Cert. Résidence)", { type: "date" })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {inp("tel", "الهاتف (Téléphone)")}
        {inp("email", "الإيميل (Email)")}
      </div>

      <SectionHeader>3. الأجر (Salaire)</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {inp("sal_base", "الأجر القاعدي (Salaire de base - DA)")}
        {inp("sal_net", "الأجر الصافي (Salaire Net - DA)")}
      </div>
    </div>
  );
}

export default function GenerateDocument() {
  const { type, id: editId } = useParams<{ type: string; id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const docType = type as DocType;
  const isEdit = !!editId;

  const [workerId, setWorkerId] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>(() => getDefaultValues(docType));
  const [lang, setLang] = useState<"ar" | "fr">("ar");
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(defaultLogo);
  const [showAvenant, setShowAvenant] = useState(false);
  const [avenant, setAvenant] = useState<AvenantData>({ ...EMPTY_AVENANT });
  const avenantRef = useRef<HTMLDivElement>(null);
  const [newWorkerOpen, setNewWorkerOpen] = useState(false);
  const [newWorker, setNewWorker] = useState({ full_name: "", position: "", cin: "", phone: "" });
  const [inlineWorkerName, setInlineWorkerName] = useState("");


  const createWorkerMutation = useMutation({
    mutationFn: () => createWorker({
      full_name: newWorker.full_name.trim(),
      position: newWorker.position.trim() || null,
      cin: newWorker.cin.trim() || null,
      phone: newWorker.phone.trim() || null,
    }),
    onSuccess: (w) => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      setWorkerId(w.id);
      setNewWorkerOpen(false);
      setNewWorker({ full_name: "", position: "", cin: "", phone: "" });
      toast.success("Nouvel employé créé");
    },
    onError: () => toast.error("Erreur lors de la création de l'employé"),
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const updateAvenant = <K extends keyof AvenantData>(field: K, value: AvenantData[K]) => {
    setAvenant((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "salBase") {
        const base = parseFloat(value as string) || 0;
        const risque = base * 0.1;
        next.primeRisque = risque ? risque.toFixed(2) : "";
        next.salPoste = base ? (base + risque).toFixed(2) : "";
      }
      return next;
    });
  };

  const openAvenant = () => {
    setAvenant((prev) => ({
      ...prev,
      numContratRef: prev.numContratRef || formData.num_contrat || "",
      salBase: prev.salBase || formData.sal_base || "",
      salNetFinal: prev.salNetFinal || formData.sal_net || "",
      dateSign: prev.dateSign || formData.date_sign || "",
    }));
    setShowAvenant(true);
    setTimeout(() => avenantRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const { data: workers } = useQuery({ queryKey: ["workers"], queryFn: getWorkers });
  const selectedWorker = workers?.find((w) => w.id === workerId);

  const isContract = docType === "contract";

  // Load existing document when editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("id", editId).single();
      if (error || !data) { toast.error("Document introuvable"); return; }
      const content = (data.content || {}) as Record<string, any>;
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(content)) {
        if (k === "worker" || k === "avenant") continue;
        if (typeof v === "string") flat[k] = v;
      }
      setFormData((p) => ({ ...p, ...flat }));
      if (data.worker_id) setWorkerId(data.worker_id);
      if (content.avenant && typeof content.avenant === "object") {
        setAvenant({ ...EMPTY_AVENANT, ...content.avenant });
        setShowAvenant(true);
      }
    })();
  }, [editId]);


  const saveMutation = useMutation({
    mutationFn: () => {
      const avenantPayload = (isContract && showAvenant ? { ...avenant } : null) as any;
      return isEdit
        ? updateDocument(editId!, {
            title: `${DOCUMENT_TYPES[docType].label} - ${selectedWorker?.full_name}`,
            content: { ...formData, worker: selectedWorker, avenant: avenantPayload },
          })
        : createDocument({
            worker_id: workerId,
            document_type: docType,
            title: `${DOCUMENT_TYPES[docType].label} - ${selectedWorker?.full_name}`,
            content: { ...formData, worker: selectedWorker, avenant: avenantPayload },
          });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] }); queryClient.invalidateQueries({ queryKey: ["workers-with-contract"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["document", editId] });
      toast.success(isEdit ? "Document mis à jour" : "Document sauvegardé");
      navigate(`/documents/${data.id}`);
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });


  if (!docType || !DOCUMENT_TYPES[docType]) {
    return <p className="text-destructive">Type de document invalide</p>;
  }

  const fields = formFieldsByType[docType];

  const handleDownloadPdf = () => {
    exportToPdf("document-preview", `${DOCUMENT_TYPES[docType].label}_${selectedWorker?.full_name ?? "doc"}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? "Modifier — " : ""}{DOCUMENT_TYPES[docType].label}</h1>
          <p className="text-muted-foreground mt-1">{isEdit ? "Modifiez les informations puis enregistrez les changements" : "Remplissez les informations pour générer le document"}</p>
        </div>
        {isContract && (
          <div className="flex flex-wrap items-center gap-2">
            <ContractsImportExport />
          </div>
        )}
      </div>

      {/* Employee selector - always on top */}
      <div className="bg-card border rounded-xl p-6">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Employé *</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[280px] max-w-md">
            <WorkerAutocomplete workers={workers} value={workerId} onChange={setWorkerId} />
          </div>
          {isContract && (
            <Button type="button" variant="outline" onClick={() => setNewWorkerOpen(true)} className="h-11">
              <UserPlus className="w-4 h-4 mr-2" />Nouvel employé
            </Button>
          )}
        </div>
        {isContract && (
          <p className="text-xs text-muted-foreground mt-2">
            L'employé n'existe pas dans la liste ? Cliquez sur « Nouvel employé » pour l'ajouter.
          </p>
        )}
      </div>

      <Dialog open={newWorkerOpen} onOpenChange={setNewWorkerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un nouvel employé</DialogTitle>
            <DialogDescription>Cet employé sera ajouté à la liste et sélectionné pour ce contrat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Nom complet *</Label>
              <Input value={newWorker.full_name} onChange={(e) => setNewWorker(p => ({ ...p, full_name: e.target.value }))} className="h-11" placeholder="Nom et prénom" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Poste</Label>
              <Input value={newWorker.position} onChange={(e) => setNewWorker(p => ({ ...p, position: e.target.value }))} className="h-11" placeholder="Poste / Fonction" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">CIN</Label>
                <Input value={newWorker.cin} onChange={(e) => setNewWorker(p => ({ ...p, cin: e.target.value }))} className="h-11" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Téléphone</Label>
                <Input value={newWorker.phone} onChange={(e) => setNewWorker(p => ({ ...p, phone: e.target.value }))} className="h-11" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewWorkerOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createWorkerMutation.mutate()}
              disabled={!newWorker.full_name.trim() || createWorkerMutation.isPending}
            >
              {createWorkerMutation.isPending ? "Création..." : "Créer et sélectionner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {isContract ? (
        /* Contract: full-width form then full-width preview */
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 space-y-6">
            {/* Lang switch */}
            <div className="flex flex-wrap items-end gap-4 justify-between border-b border-border pb-4">
              <div className="flex gap-2">
                <Button type="button" variant={lang === "ar" ? "default" : "outline"} size="sm" onClick={() => setLang("ar")}>عربي</Button>
                <Button type="button" variant={lang === "fr" ? "default" : "outline"} size="sm" onClick={() => setLang("fr")}>Français</Button>
              </div>
              <div className="flex items-center gap-3">
                <img src={defaultLogo} alt="Logo ERCM" className="h-12 w-auto" />
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Remplacer le logo (optionnel)</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} className="h-10 max-w-xs" />
                </div>
              </div>
            </div>

            <ContractForm formData={formData} setFormData={setFormData} worker={selectedWorker} />

            <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
              <Button onClick={() => saveMutation.mutate()} disabled={!workerId || saveMutation.isPending} className="flex-1 min-w-[160px]">
                <Save className="w-4 h-4 mr-2" />{saveMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
              <Button onClick={() => window.print()} variant="outline" disabled={!workerId}>
                <Printer className="w-4 h-4 mr-2" />Imprimer
              </Button>
              <Button onClick={handleDownloadPdf} variant="outline" disabled={!workerId}>
                <Download className="w-4 h-4 mr-2" />PDF
              </Button>
              <Button onClick={openAvenant} variant="secondary" disabled={!workerId}>
                <Plus className="w-4 h-4 mr-2" />Avenant
              </Button>
            </div>

            {/* Avenant inline form */}
            {showAvenant && (
              <div className="mt-4 p-4 border-2 border-primary/40 rounded-lg bg-accent/20 space-y-4">
                <h3 className="text-center font-bold text-lg">📎 ملحق رقم {avenant.numAvenant} - تفصيل الأجر</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">رقم الملحق</Label>
                    <Input value={avenant.numAvenant} onChange={(e) => updateAvenant("numAvenant", e.target.value)} className="h-11" /></div>
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">رقم العقد المرجعي</Label>
                    <Input value={avenant.numContratRef} onChange={(e) => updateAvenant("numContratRef", e.target.value)} className="h-11" /></div>
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">تاريخ التحرير</Label>
                    <DateInput value={avenant.dateSign} onChange={(e) => updateAvenant("dateSign", e.target.value)} className="h-11" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">الأجر القاعدي (DA)</Label>
                    <Input value={avenant.salBase} onChange={(e) => updateAvenant("salBase", e.target.value)} className="h-11" /></div>
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">علاوة الخطر 10% (DA)</Label>
                    <Input value={avenant.primeRisque} onChange={(e) => updateAvenant("primeRisque", e.target.value)} className="h-11" /></div>
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">أجر المنصب (DA)</Label>
                    <Input value={avenant.salPoste} onChange={(e) => updateAvenant("salPoste", e.target.value)} className="h-11" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">منحة النقل (DA)</Label>
                    <Input value={avenant.primeTransport} onChange={(e) => updateAvenant("primeTransport", e.target.value)} className="h-11" /></div>
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">منحة السلة (DA)</Label>
                    <Input value={avenant.primePanier} onChange={(e) => updateAvenant("primePanier", e.target.value)} className="h-11" /></div>
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">الأجر الصافي النهائي (DA)</Label>
                    <Input value={avenant.salNetFinal} onChange={(e) => updateAvenant("salNetFinal", e.target.value)} className="h-11" /></div>
                </div>
                <Button type="button" variant="outline" onClick={() => setShowAvenant(false)} size="sm">Masquer le ملحق</Button>
              </div>
            )}
          </div>

          {selectedWorker && (
            <div id="document-preview">
              <ContractPreview worker={selectedWorker} data={formData} lang={lang} logoDataUrl={logoDataUrl} />
            </div>
          )}

          {selectedWorker && showAvenant && (
            <div ref={avenantRef} id="avenant-preview">
              <AvenantPreview worker={selectedWorker} avenant={avenant} contractData={formData} logoDataUrl={logoDataUrl} />
            </div>
          )}

        </div>
      ) : (
        /* Other doc types: side by side */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card border rounded-xl p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">{field.label}</Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      value={formData[field.key] ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                    />
                  ) : field.type === "date" ? (
                    <DateInput
                      value={formData[field.key] ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="h-11"
                    />
                  ) : (
                    <Input
                      type={field.type ?? "text"}
                      value={formData[field.key] ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="h-11"
                    />
                  )}
                </div>
              ))}
              {docType === "bon_sortie" && !!formData.sortie_time && (
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Heure de rentrée
                  </Label>
                  <Input
                    type="time"
                    value={formData.rentree_time ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, rentree_time: e.target.value }))}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Affiché car l'employé est sorti — renseignez l'heure de retour.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2 border-t border-border">
              <Button onClick={() => saveMutation.mutate()} disabled={!workerId || saveMutation.isPending} className="flex-1">
                <Save className="w-4 h-4 mr-2" />{saveMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          </div>

          {selectedWorker && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <Button onClick={() => window.print()} variant="outline" size="sm">
                  <Printer className="w-4 h-4 mr-2" />Imprimer
                </Button>
                <Button onClick={handleDownloadPdf} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />Télécharger PDF
                </Button>
              </div>
              <div id="document-preview">
                <DocumentPreview type={docType} worker={selectedWorker} data={formData} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
