import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODULES, ROLES, UserRole } from "@/lib/permissions";
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
  const [savingPerms, setSavingPerms] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", full_name: "", role: "CLIENT" as UserRole });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setUsers((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEditor = async (u: ProfileRow) => {
    setEditing(u);
    const { data } = await supabase
      .from("permissions" as any)
      .select("module,can_view,can_create,can_edit,can_delete")
      .eq("user_id", u.id);
    const existing = (data as any as PermRow[]) ?? [];
    const merged = MODULES.map(m => existing.find(e => e.module === m.key) ?? blankPerm(m.key));
    setPerms(merged);
  };

  const togglePerm = (module: string, field: keyof PermRow) => {
    setPerms(p => p.map(x => x.module === module ? { ...x, [field]: !x[field] } : x));
  };

  const savePerms = async () => {
    if (!editing) return;
    setSavingPerms(true);
    const rows = perms.map(p => ({ ...p, user_id: editing.id }));
    const { error } = await supabase.from("permissions" as any).upsert(rows, { onConflict: "user_id,module" });
    setSavingPerms(false);
    if (error) toast.error(error.message);
    else { toast.success("Permissions enregistrées"); setEditing(null); }
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
              <TableHead>Actif</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
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
                  return (
                    <TableRow key={p.module}>
                      <TableCell className="font-medium">{m?.label || p.module}</TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.can_view} onCheckedChange={() => togglePerm(p.module, "can_view")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.can_create} onCheckedChange={() => togglePerm(p.module, "can_create")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.can_edit} onCheckedChange={() => togglePerm(p.module, "can_edit")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.can_delete} onCheckedChange={() => togglePerm(p.module, "can_delete")} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
