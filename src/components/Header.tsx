import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoErcm from "@/assets/logo-ercm.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const PAGE_TITLES: Array<[string, string]> = [
  ["/admin/permissions", "Permissions"],
  ["/workers", "Employés"],
  ["/documents", "Documents"],
  ["/generate", "Génération de documents"],
  ["/statistics", "Statistiques"],
  ["/acomptes", "Acomptes"],
  ["/absences", "Absences"],
  ["/conges", "Congés"],
  ["/", "Tableau de bord"],
];

function usePageTitle(pathname: string): string {
  for (const [prefix, label] of PAGE_TITLES) {
    if (prefix === "/") {
      if (pathname === "/") return label;
      continue;
    }
    if (pathname.startsWith(prefix)) return label;
  }
  return "Rh Doc Gen";
}

const initials = (name?: string | null) =>
  (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export default function Header({ onToggleSidebar }: HeaderProps) {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = usePageTitle(location.pathname);

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-2">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {isMobile ? (
          <>
            <img src={logoErcm} alt="ERCM" className="h-7 w-auto" />
            <span className="text-sm font-bold text-primary">Rh Doc Gen</span>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground/70">ERCM SA</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-semibold text-foreground">{pageTitle}</span>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-inset ring-primary/20 sm:flex">
                {initials(user.full_name || user.username)}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[13px] font-medium leading-tight">{user.full_name || user.username}</p>
                <p className="text-[11px] leading-tight text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {user.role}
            </Badge>
            <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Déconnexion" className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}