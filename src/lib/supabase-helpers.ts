import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Worker = Database["public"]["Tables"]["workers"]["Row"];
type WorkerInsert = Database["public"]["Tables"]["workers"]["Insert"];
type Document = Database["public"]["Tables"]["documents"]["Row"];
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];

export type { Worker, WorkerInsert, Document, DocumentInsert };

export async function getWorkers() {
  const { data, error } = await supabase.from("workers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getWorkerIdsWithContract(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("documents")
    .select("worker_id")
    .eq("document_type", "contract");
  if (error) throw error;
  return new Set((data ?? []).map((d: any) => d.worker_id).filter(Boolean));
}

export async function workerHasContract(workerId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("document_type", "contract")
    .eq("worker_id", workerId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getWorker(id: string) {
  const { data, error } = await supabase.from("workers").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createWorker(worker: WorkerInsert) {
  const { data, error } = await supabase.from("workers").insert(worker).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id: string, worker: Partial<WorkerInsert>) {
  const { data, error } = await supabase.from("workers").update(worker).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteWorker(id: string) {
  const { error } = await supabase.from("workers").delete().eq("id", id);
  if (error) throw error;
}

export async function getDocuments() {
  const { data, error } = await supabase.from("documents").select("*, workers(full_name, department)").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDocumentsByWorker(workerId: string) {
  const { data, error } = await supabase.from("documents").select("*").eq("worker_id", workerId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDocument(doc: DocumentInsert) {
  const { data, error } = await supabase.from("documents").insert(doc).select().single();
  if (error) throw error;
  return data;
}

export async function updateDocument(id: string, doc: Partial<DocumentInsert>) {
  const { data, error } = await supabase.from("documents").update(doc).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(id: string) {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function validateDocument(id: string, role: "responsible" | "rh", validatorId?: string) {
  const updates: Record<string, any> = {};
  if (role === "responsible") {
    updates.validated_by_responsible = true;
    updates.responsible_validated_at = new Date().toISOString();
    if (validatorId) updates.responsible_validator_id = validatorId;
  } else {
    updates.validated_by_rh = true;
    updates.rh_validated_at = new Date().toISOString();
    if (validatorId) updates.rh_validator_id = validatorId;
  }
  const { data, error } = await supabase.from("documents").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function getDepartmentHeads() {
  const { data, error } = await supabase.from("workers").select("*").eq("is_department_head", true);
  if (error) throw error;
  return data;
}

// ===== Acomptes =====
export type AcompteTransaction = {
  id: string;
  worker_id: string;
  type: "acompte" | "dette" | "reglement";
  amount: number;
  previous_balance: number | null;
  new_balance: number | null;
  transaction_date: string;
  note: string | null;
  created_at: string;
};

export async function getAcomptes(workerId?: string) {
  let query = (supabase as any).from("acompte_transactions").select("*, workers(full_name, matricule, department)").order("created_at", { ascending: false });
  if (workerId) query = query.eq("worker_id", workerId);
  const { data, error } = await query;
  if (error) throw error;
  return data as (AcompteTransaction & { workers?: { full_name: string; matricule: string | null; department: string | null } })[];
}

export type AcompteType = "acompte" | "dette" | "reglement";

export async function createAcompte(params: { worker_id: string; type: AcompteType | "add" | "subtract"; amount: number; transaction_date: string; note?: string }) {
  // Backward-compat mapping
  const type: AcompteType = params.type === "add" ? "acompte" : params.type === "subtract" ? "reglement" : params.type;

  const { data: tx, error } = await (supabase as any).from("acompte_transactions").insert({
    worker_id: params.worker_id,
    type,
    amount: params.amount,
    transaction_date: params.transaction_date,
    note: params.note ?? null,
  }).select().single();
  if (error) throw error;

  // Refresh worker current_balance = total acomptes + dettes - reglements
  await refreshWorkerBalance(params.worker_id);
  return tx as AcompteTransaction;
}

export async function refreshWorkerBalance(workerId: string) {
  const { data, error } = await (supabase as any)
    .from("acompte_transactions")
    .select("type, amount")
    .eq("worker_id", workerId);
  if (error) throw error;
  let bal = 0;
  (data || []).forEach((t: any) => {
    const a = Number(t.amount) || 0;
    if (t.type === "acompte" || t.type === "dette") bal += a;
    else if (t.type === "reglement") bal -= a;
  });
  await supabase.from("workers").update({ current_balance: Math.max(0, bal) } as any).eq("id", workerId);
}

export async function deleteAcompte(id: string) {
  const { data: tx, error } = await (supabase as any).from("acompte_transactions").select("*").eq("id", id).single();
  if (error) throw error;
  await (supabase as any).from("acompte_transactions").delete().eq("id", id);
  if (tx?.worker_id) await refreshWorkerBalance(tx.worker_id);
}


// ===== Absences =====
export type Absence = {
  id: string;
  worker_id: string;
  absence_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AbsenceWithWorker = Absence & {
  workers?: { full_name: string; matricule: string | null; department: string | null } | null;
};

export async function getAbsences(workerId?: string, month?: string) {
  let q = (supabase as any).from("absences").select("*, workers(full_name, matricule, department)").order("absence_date", { ascending: false });
  if (workerId) q = q.eq("worker_id", workerId);
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const endDate = new Date(y, m, 1); // first day of next month
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
    q = q.gte("absence_date", start).lt("absence_date", end);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as AbsenceWithWorker[];
}

export async function createAbsence(params: { worker_id: string; absence_date: string; reason?: string }) {
  const { data, error } = await (supabase as any).from("absences").insert({
    worker_id: params.worker_id,
    absence_date: params.absence_date,
    reason: params.reason ?? null,
  }).select().single();
  if (error) throw error;
  return data as Absence;
}

export async function createAbsencesBulk(params: { worker_ids: string[]; absence_date: string; reason?: string }) {
  const rows = params.worker_ids.map((wid) => ({
    worker_id: wid,
    absence_date: params.absence_date,
    reason: params.reason ?? null,
  }));
  const { data, error } = await (supabase as any).from("absences").insert(rows).select();
  if (error) throw error;
  return data as Absence[];
}

export async function updateAbsence(id: string, params: { absence_date?: string; reason?: string | null }) {
  const { data, error } = await (supabase as any).from("absences").update(params).eq("id", id).select().single();
  if (error) throw error;
  return data as Absence;
}

export async function deleteAbsence(id: string) {
  const { error } = await (supabase as any).from("absences").delete().eq("id", id);
  if (error) throw error;
}

// ===== Congés =====
export const CONGE_TYPES = {
  annual: "Congé annuel",
  sick: "Congé maladie",
  unpaid: "Congé sans solde",
  maternity: "Congé maternité",
  paternity: "Congé paternité",
  exceptional: "Congé exceptionnel",
} as const;
export type CongeType = keyof typeof CONGE_TYPES;

export type Conge = {
  id: string;
  worker_id: string;
  start_date: string;
  end_date: string;
  conge_type: CongeType;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CongeWithWorker = Conge & {
  workers?: { full_name: string; matricule: string | null; department: string | null } | null;
};

export function congeDuration(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export async function getConges(
  workerId?: string,
  opts?: { from?: string; to?: string; type?: CongeType | "all" },
) {
  let q = (supabase as any).from("conges").select("*, workers(full_name, matricule, department)").order("start_date", { ascending: false });
  if (workerId && workerId !== "all") q = q.eq("worker_id", workerId);
  if (opts?.type && opts.type !== "all") q = q.eq("conge_type", opts.type);
  // period overlap: end_date >= from AND start_date < to
  if (opts?.from) q = q.gte("end_date", opts.from);
  if (opts?.to) q = q.lt("start_date", opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return data as CongeWithWorker[];
}


export async function createConge(params: { worker_id: string; start_date: string; end_date: string; conge_type: CongeType; reason?: string }) {
  if (new Date(params.end_date) < new Date(params.start_date)) {
    throw new Error("La date de fin doit être après la date de début");
  }
  const { data, error } = await (supabase as any).from("conges").insert({
    worker_id: params.worker_id,
    start_date: params.start_date,
    end_date: params.end_date,
    conge_type: params.conge_type,
    reason: params.reason ?? null,
  }).select().single();
  if (error) throw error;
  return data as Conge;
}

export async function createCongesBulk(params: { worker_ids: string[]; start_date: string; end_date: string; conge_type: CongeType; reason?: string }): Promise<{ success: number; failed: { worker_id: string; message: string }[] }> {
  if (new Date(params.end_date) < new Date(params.start_date)) {
    throw new Error("La date de fin doit être après la date de début");
  }
  const failed: { worker_id: string; message: string }[] = [];
  let success = 0;
  // Insert one-by-one so per-worker overlap trigger errors don't cancel everything
  for (const wid of params.worker_ids) {
    const { error } = await (supabase as any).from("conges").insert({
      worker_id: wid,
      start_date: params.start_date,
      end_date: params.end_date,
      conge_type: params.conge_type,
      reason: params.reason ?? null,
    });
    if (error) failed.push({ worker_id: wid, message: error.message });
    else success++;
  }
  return { success, failed };
}

export async function updateConge(id: string, params: Partial<{ start_date: string; end_date: string; conge_type: CongeType; reason: string | null }>) {
  if (params.start_date && params.end_date && new Date(params.end_date) < new Date(params.start_date)) {
    throw new Error("La date de fin doit être après la date de début");
  }
  const { data, error } = await (supabase as any).from("conges").update(params).eq("id", id).select().single();
  if (error) throw error;
  return data as Conge;
}

export async function deleteConge(id: string) {
  const { error } = await (supabase as any).from("conges").delete().eq("id", id);
  if (error) throw error;
}

export const DOCUMENT_TYPES = {
  contract: { label: "Contrat de travail", icon: "FileText" },
  bon_sortie: { label: "Bon de sortie", icon: "LogOut" },
  avertissement: { label: "Avertissement", icon: "AlertTriangle" },
} as const;
