import { useState, FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import logoErcm from "@/assets/logo-ercm.png";
import { Loader2, Building2 } from "lucide-react";

export default function Login() {
  const { session, signIn, loading } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="mx-auto h-14 w-14 rounded-xl" />
          <Skeleton className="mx-auto h-5 w-40" />
          <Skeleton className="mx-auto h-3 w-56" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    );
  if (session) {
    const params = new URLSearchParams(location.search);
    const nextRaw = params.get("next");
    // Only accept same-origin relative paths.
    const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null;
    const from = next || (location.state as any)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await signIn(username, password);
    setBusy(false);
    if (error) setErr(error);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Subtle branding accents */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      <div className="w-full max-w-sm border bg-card p-8 shadow-dialog sm:rounded-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20">
            <img src={logoErcm} alt="ERCM" className="h-9 w-auto object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-primary">Rh Doc Gen</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Connexion à votre espace</p>
          <div className="mt-4 flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            ERCM SA — Gestion documentaire
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="field-label">Nom d'utilisateur</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="field-label">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>
          {err && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {err}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Se connecter
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Les comptes sont créés par l'administrateur.
        </p>
      </div>
    </div>
  );
}