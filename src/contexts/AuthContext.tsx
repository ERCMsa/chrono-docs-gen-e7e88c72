import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ModuleKey, PermissionAction, UserRole, PermissionRow } from "@/lib/permissions";
import { resolveVisibleDepartments, normalizeDepartment } from "@/lib/permissions";

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface Permission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: Profile | null;
  role: UserRole | null;
  permissions: Permission[];
  /** Départements explicitement attribués à l'utilisateur (table user_departments). */
  departments: string[];
  /** Départements que l'utilisateur a le droit de voir (portée effective). */
  visibleDepartments: string[];
  /** true si l'utilisateur voit tous les départements (ADMIN / RH). */
  isGlobalScope: boolean;
  loading: boolean;
  hasPermission: (module: ModuleKey | string, action: PermissionAction) => boolean;
  /** Vérifie une action (create/edit/delete/view) sur un module. */
  can: (module: ModuleKey | string, action: PermissionAction) => boolean;
  /** true si l'utilisateur peut voir les employés du département donné. */
  canAccessDepartment: (dept?: string | null) => boolean;
  isAdmin: () => boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USERNAME_DOMAIN = "ercmsa.internal";
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${USERNAME_DOMAIN}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const [{ data: prof }, { data: perms }, { data: deps }] = await Promise.all([
      supabase.from("profiles" as any).select("*").eq("id", uid).maybeSingle(),
      supabase.from("permissions" as any).select("module,can_view,can_create,can_edit,can_delete").eq("user_id", uid),
      supabase.from("user_departments" as any).select("department").eq("user_id", uid),
    ]);
    setUser((prof as any) ?? null);
    setPermissions((perms as any) ?? []);
    setDepartments(((deps as any) ?? []).map((d: any) => d.department).filter(Boolean));
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setUser(null);
        setPermissions([]);
        setDepartments([]);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) return { error: "Identifiants invalides" };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPermissions([]);
    setDepartments([]);
  };

  const isAdmin = () => user?.role === "ADMIN" && user?.is_active === true;

  const hasPermission = (module: ModuleKey | string, action: PermissionAction) => {
    if (isAdmin()) return true;
    const p = permissions.find((x) => x.module === module);
    if (!p) return false;
    switch (action) {
      case "view": return p.can_view;
      case "create": return p.can_create;
      case "edit": return p.can_edit;
      case "delete": return p.can_delete;
    }
  };

  // Portée « employés » : départements visibles
  const scope = resolveVisibleDepartments({
    isAdmin: isAdmin(),
    role: user?.role ?? null,
    assigned: departments,
  });

  const canAccessDepartment = (dept?: string | null) => {
    if (scope.global) return true;
    const d = normalizeDepartment(dept);
    // Un employé sans département n'est pas visible d'une portée restreinte
    if (!d) return false;
    return scope.departments.includes(d);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role: user?.role ?? null,
        permissions,
        departments,
        visibleDepartments: scope.departments,
        isGlobalScope: scope.global,
        loading,
        hasPermission,
        can: (module, action) => hasPermission(module, action),
        canAccessDepartment,
        isAdmin,
        signIn,
        signOut,
        refresh: () => (session?.user ? loadProfile(session.user.id) : Promise.resolve()),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
