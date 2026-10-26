import { DEPARTMENTS } from "@/lib/departments";

export const MODULES = [
  { key: "employees", label: "Employés" },
  { key: "payroll", label: "Paie / Acomptes" },
  { key: "leave", label: "Congés / Absences" },
  // « documents » contrôl l'accès aux ÉCRANS (routes gatées sur ce module) ;
  // les 5 clés doc_* contrôlent ce qui est visible et supprimable par type.
  { key: "documents", label: "Documents — accès aux écrans" },
  { key: "doc_contract", label: "Documents — Contrats" },
  { key: "doc_bon_sortie", label: "Documents — Bons de sortie" },
  { key: "doc_bon_entree", label: "Documents — Bons d'entrée" },
  { key: "doc_autorisation_absence", label: "Documents — Autorisations d'absence" },
  { key: "doc_avertissement", label: "Documents — Avertissements" },
  { key: "reports", label: "Rapports / Statistiques" },
  { key: "settings", label: "Paramètres" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type PermissionAction = "view" | "create" | "edit" | "delete";

/** Écrans réels rattachés à chaque module (les modules sans page sont réservés). */
export const MODULE_PAGES: Partial<Record<ModuleKey, { path: string; label: string }[]>> = {
  employees: [
    { path: "/workers", label: "Liste des employés" },
    { path: "/workers/:id", label: "Fiche employé" },
  ],
  documents: [
    { path: "/documents", label: "Documents" },
    { path: "/generate/:type", label: "Génération" },
  ],
  doc_contract: [
    { path: "/generate/contract", label: "Contrat" },
    { path: "/contracts", label: "Liste des contrats" },
  ],
  doc_bon_sortie: [{ path: "/generate/bon_sortie", label: "Bon de sortie" }],
  doc_bon_entree: [{ path: "/generate/bon_entree", label: "Bon d'entrée" }],
  doc_autorisation_absence: [{ path: "/generate/autorisation_absence", label: "Autorisation d'absence" }],
  doc_avertissement: [{ path: "/generate/avertissement", label: "Avertissement" }],
  leave: [
    { path: "/conges", label: "Congés" },
    { path: "/absences", label: "Absences" },
  ],
  payroll: [{ path: "/acomptes", label: "Acomptes" }],
  reports: [{ path: "/statistics", label: "Statistiques" }],
  settings: [{ path: "/admin/permissions", label: "Administration" }],
};

/** Permissions d'un module (ligne de la table public.permissions). */
export type PermissionRow = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/**
 * Règle d'autorisation unique, appliquée partout (UI des actions + gardes de route).
 * L'ADMIN contourne tout ; sans ligne de permissions pour le module, tout est refusé.
 */
export function canAct(
  perms: PermissionRow[] | undefined,
  module: ModuleKey | string,
  action: PermissionAction,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  const p = perms?.find((x) => x.module === module);
  if (!p) return false;
  switch (action) {
    case "view": return p.can_view;
    case "create": return p.can_create;
    case "edit": return p.can_edit;
    case "delete": return p.can_delete;
  }
}

/** Normalise un nom de département (casse, underscores, espaces multiples). */
export function normalizeDepartment(dept?: string | null): string {
  return (dept ?? "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

/** Modules de permission, un par type de document (nécessite l'accès « documents » pour les écrans). */
export const DOC_TYPE_MODULES = [
  "doc_contract",
  "doc_bon_sortie",
  "doc_bon_entree",
  "doc_autorisation_absence",
  "doc_avertissement",
] as const;

/** Mapping document_type -> module de permission. */
export const DOCUMENT_TYPE_MODULE: Record<string, ModuleKey> = {
  contract: "doc_contract",
  bon_sortie: "doc_bon_sortie",
  bon_entree: "doc_bon_entree",
  autorisation_absence: "doc_autorisation_absence",
  avertissement: "doc_avertissement",
};

/** Module de permissions d'un type de document, ou null si inconnu. */
export function documentModule(type: string): ModuleKey | null {
  return DOCUMENT_TYPE_MODULE[type] ?? null;
}

/**
 * true si l'utilisateur possède AU MOINS UNE ligne doc_* (mode précis).
 * ATTENTION : ne jamais tester `module.startsWith("doc")` — « documents »
 * commence aussi par "doc" ; utiliser la liste explicite DOC_TYPE_MODULES.
 */
export function hasDocTypeRow(perms: { module: string }[] | undefined): boolean {
  return !!perms?.some((p) => (DOC_TYPE_MODULES as readonly string[]).includes(p.module));
}

/**
 * Permission d'une action sur un type de document.
 * RÈGLE ANTI-BLOCAGE : si l'utilisateur n'a AUCUNE ligne doc_* (comptes
 * hérités, jamais re-sauvegardés depuis l'ajout des types), on retombe sur
 * la permission « documents », afin qu'aucun écran ne devienne inaccessible.
 */
export function canDocumentType(
  perms: PermissionRow[] | undefined,
  type: string,
  action: PermissionAction,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (!hasDocTypeRow(perms)) return canAct(perms, "documents", action, false);
  const module = documentModule(type);
  if (!module) return false;
  return canAct(perms, module, action, false);
}

/**
 * Rôles qui ne correspondent pas à un département de la liste DEPARTMENTS
 * (mais dont l'équivalent existe).
 */
const ROLE_DEPARTMENT_ALIAS: Record<string, string> = {
  IT: "IT DEVELOPMENT",
  GENIE_CIVIL: "GENIE CIVIL",
  ADMIN: "ADMINISTRATION",
};

/**
 * Départements visibles par un utilisateur.
 * - ADMIN / RH : portée globale (tous les départements), comme aujourd'hui.
 * - sinon, si des départements ont été attribués : seuls ceux-ci.
 * - sinon (aucune attribution) : repli sur le rôle de l'utilisateur, qui double
 *   comme un département (PRODUCTION -> PRODUCTION) ; un rôle qui n'est pas un
 *   département (CLIENT, VISITEUR...) ne donne aucune visibilité.
 */
export function resolveVisibleDepartments(args: {
  isAdmin: boolean;
  role: string | null;
  assigned: string[];
}): { global: boolean; departments: string[] } {
  const { isAdmin, role, assigned } = args;
  if (isAdmin || (role ?? "").toUpperCase() === "RH") {
    return { global: true, departments: [] };
  }
  const list = (assigned ?? [])
    .map((d) => normalizeDepartment(d))
    .filter(Boolean);
  if (list.length > 0) {
    return { global: false, departments: Array.from(new Set(list)) };
  }
  const normalizedRole = normalizeDepartment(role);
  if (!normalizedRole) return { global: false, departments: [] };
  const aliased = ROLE_DEPARTMENT_ALIAS[normalizedRole] ?? normalizedRole;
  if (!DEPARTMENTS.map((d) => normalizeDepartment(d)).includes(aliased)) {
    return { global: false, departments: [] };
  }
  return { global: false, departments: [aliased] };
}

export const ROLES = [
  "ADMIN","PRODUCTION","ENGINEER","MAINTENANCE","GDS","MONTAGE",
  "IT","GENIE_CIVIL","RH","FINANCE","CLIENT","HSE",
  "CNC","VISITEUR","UNITE_ONE","UNITE_TWO","GERANT",
  "ADRAR",
] as const;
export type UserRole = (typeof ROLES)[number];
