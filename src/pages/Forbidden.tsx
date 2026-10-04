import { ShieldAlert } from "lucide-react";

export default function Forbidden({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-inset ring-destructive/20">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Accès refusé</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {message ?? "Vous n'avez pas les permissions nécessaires pour accéder à cette page."}
      </p>
    </div>
  );
}