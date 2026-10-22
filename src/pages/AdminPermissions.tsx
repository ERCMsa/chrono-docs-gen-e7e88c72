import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODULES, MODULE_PAGES, ROLES, UserRole, DOC_TYPE_MODULES } from "@/lib/permissions";
import { DEPARTMENTS } from "@/lib/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, KeyRound, Loader2 } from "lucide-react";

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

interface PermRow {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const blankPerm = (module: string): PermRow => ({
  module, can_view: false, can_create: false, can_edit: false, can_delete: false,
});

export default function AdminPermissions() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [deptCounts, setDeptCounts] = useState<Record<string, number>>({});
  const [savingPerms, setSavingPerms] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", full_name: "", role: "CLIENT" as UserRole });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: deps }] = await Promise.all([
      supabase
        .from("profiles" as any)
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("user_departments" as any).select("user_id,department"),
    ]);
    if (error) toast.error(error.message);
    setUsers((data as any) ?? []);
    const counts: Record<string, number> = {};
    for (const d of (deps as any) ?? []) {
      if (!d?.user_id) continue;
      counts[d.user_id] = (counts[d.user_id] ?? 0) + 1;
    }
    setDeptCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEditor = async (u: ProfileRow) => {
    setEditing(u);
    const [{ data }, { data: deps }] = await Promise.all([
      supabase
        .from("permissions" as any)
        .select("module,can_view,can_create,can_edit,can_delete")
        .eq("user_id", u.id),
      supabase
        .from("user_departments" as any)
        .select("department")
        .eq("user_id", u.id),
    ]);
    const existing = (data as any as PermRow[]) ?? [];
    const merged = MODULES.map(m => existing.find(e => e.module === m.key) ?? blankPerm(m.key));
    setPerms(merged);
    setUserDepartments(((deps as any) ?? []).map((d: any) => d.department).filter(Boolean));
  };

  const togglePerm = (module: string, field: keyof PermRow) => {
    setPerms(p => {
      let next = p.map(x => x.module === module ? { ...x, [field]: !x[field] } : x);
      // Comodité : cocher « Documents — voir » coche la vue des 4 types de
      // documents (décochable ensuite type par type).
      if (module === "documents" && field === "can_view") {
        const viewOn = next.find(x => x.module === "documents")?.can_view ?? false;
        next = next.map(x =>
          (DOC_TYPE_MODULES as readonly string[]).includes(x.module)
            ? { ...x, can_view: viewOn }
            : x,
        );
      }
      return next;
    });
  };

  const toggleDepartment = (department: string) => {
    setUserDepartments(d => (d.includes(department) ? d.filter(x => x !== department) : [...d, department]));
  };

  const savePerms = async () => {
    if (!editing) return;
    setSavingPerms(true);
    const rows = perms.map(p => ({ ...p, user_id: editing.id }));
    const { error } = await supabase.from("permissions" as any).upsert(rows, { onConflict: "user_id,module" });
    if (error) {
      setSavingPerms(false);
      toast.error(error.message);
      return;
    }
    // Portée départements : on remplace l'ensemble (un upsert seul ne révoque rien)
    const { error: delError } = await supabase
      .from("user_departments" as any)
      .delete()
      .eq("user_id", editing.id);
    if (delError) {
      setSavingPerms(false);
      toast.error(delError.message);
      return;
    }
    if (userDepartments.length > 0) {
      const { error: insError } = await supabase
        .from("user_departments" as any)
        .insert(userDepartments.map(department => ({ user_id: editing.id, department })));
      if (insError) {
        setSavingPerms(false);
        toast.error(insError.message);
        return;
      }
    }
    setSavingPerms(false);
    // Avertissement (non bloquant) : accès aux écrans sans aucun type de document
    const docRow = perms.find(p => p.module === "documents");
    const anyTypeView = perms.some(
      p => (DOC_TYPE_MODULES as readonly string[]).includes(p.module) && p.can_view,
    );
    if (docRow?.can_view && !anyTypeView) {
      toast.warning("La page Documents restera vide.");
    }
    toast.success("Permissions enregistrées");
    setEditing(null);
    load();
  };

  const changeRole = async (u: ProfileRow, role: UserRole) => {
    const { error } = await supabase.from("profiles" as any).update({ role }).eq("id", u.id);
    if (error) toast.error(error.message);
    else { toast.success("Rôle mis à jour"); load(); }
  };

  const toggleActive = async (u: ProfileRow) => {
    const { error } = await supabase.from("profiles" as any).update({ is_active: !u.is_active }).eq("id", u.id);
    if (error) toast.error(error.message);
    else load();
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      toast.error("Nom d'utilisateur et mot de passe requis");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-user", { body: newUser });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erreur");
      return;
    }
    toast.success("Utilisateur créé");
    setCreateOpen(false);
    setNewUser({ username: "", password: "", full_name: "", role: "CLIENT" });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des permissions"
        description="Utilisateurs, rôles et permissions par module"
      >
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouvel utilisateur</Button>
      </PageHeader>

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom d'utilisateur</TableHead>
              <TableHead>Nom complet</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Départements</TableHead>
              <TableHead>Actif</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
            ) : users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>{u.full_name || "—"}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => changeRole(u, v as UserRole)}>
                    <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {u.role === "ADMIN" ? (
                    <span className="text-xs text-muted-foreground">Accès global</span>
                  ) : (deptCounts[u.id] ?? 0) > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {deptCounts[u.id]} département{(deptCounts[u.id] ?? 0) > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Son département</span>
                  )}
                </TableCell>
                <TableCell><Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} /></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openEditor(u)}>
                    <KeyRound className="w-4 h-4 mr-1" />Permissions
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Permissions de {editing?.username}</DialogTitle></DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-center">Voir</TableHead>
                  <TableHead className="text-center">Créer</TableHead>
                  <TableHead className="text-center">Modifier</TableHead>
                  <TableHead className="text-center">Supprimer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perms.map(p => {
                  const m = MODULES.find(x => x.key === p.module);
                  const pages = (MODULE_PAGES as Record<string, { path: string; label: string }[]>)[p.module];
                  const hasPage = !!pages && pages.length > 0;
                  return (
                    <TableRow key={p.module} className={cn(!hasPage && "opacity-60")}>
                      <TableCell className="font-medium">
                        {m?.label || p.module}
                        <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                          {hasPage ? pages.map((pg) => pg.label).join(" • ") : "Aucun écran"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center"><Checkbox disabled={!hasPage} checked={p.can_view} onCheckedChange={() => togglePerm(p.module, "can_view")} /></TableCell>
                      <TableCell className="text-center"><Checkbox disabled={!hasPage} checked={p.can_create} onCheckedChange={() => togglePerm(p.module, "can_create")} /></TableCell>
                      <TableCell className="text-center"><Checkbox disabled={!hasPage} checked={p.can_edit} onCheckedChange={() => togglePerm(p.module, "can_edit")} /></TableCell>
                      <TableCell className="text-center"><Checkbox disabled={!hasPage} checked={p.can_delete} onCheckedChange={() => togglePerm(p.module, "can_delete")} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Documents — accès aux écrans</span> contrôle l'ouverture des pages
            Documents et Génération ; les 4 types (contrat, bon de sortie, bon d'entrée, avertissement)
            contrôlent ce qui est visible et supprimable.
          </p>
          <p className="text-xs text-muted-foreground">
            Un compte ADMIN dispose automatiquement de toutes les permissions et de tous les départements.
          </p>

          {/* Portée départements */}
          <div className="border rounded-lg p-4">
            <p className="text-sm font-semibold">Départements visibles</p>
            <p className="mt-1 text-xs text-muted-foreground">
              L'utilisateur ne verra que les employés de ces départements. Sans attribution,
              il ne voit que son propre département.
            </p>
            {editing?.role === "ADMIN" ? (
              <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Accès global (ADMIN)
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEPARTMENTS.map(d => (
                  <label
                    key={d}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={userDepartments.includes(d)}
                      onCheckedChange={() => toggleDepartment(d)}
                    />
                    <span className="truncate">{d}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={savePerms} disabled={savingPerms}>
              {savingPerms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom d'utilisateur</Label><Input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} /></div>
            <div><Label>Mot de passe</Label><Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /></div>
            <div><Label>Nom complet</Label><Input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} /></div>
            <div>
              <Label>Rôle</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={createUser} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
