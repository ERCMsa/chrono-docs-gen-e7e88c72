import { Link, useLocation } from "react-router-dom";
import {
  Users, LayoutDashboard, LogOut, AlertTriangle, FilePlus, BarChart3, FileText, Files, X, Wallet, CalendarX, CalendarRange, Shield, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import logoErcm from "@/assets/logo-ercm.png";
import { useAuth } from "@/contexts/AuthContext";
import type { ModuleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  module?: ModuleKey;
  adminOnly?: boolean;
  rhOrAdmin?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
      { to: "/workers", label: "Employés", icon: Users, module: "employees" },
      { to: "/documents", label: "Documents", icon: FileText, module: "documents" },
      { to: "/contracts", label: "Contracts List", icon: Files, module: "documents" },
    ],
  },
  {
    label: "Génération",
    items: [
      { to: "/generate/contract", label: "Contrat", icon: FilePlus, module: "documents" },
      { to: "/generate/bon_sortie", label: "Bon de sortie", icon: LogOut, module: "documents" },
      { to: "/generate/avertissement", label: "Avertissement", icon: AlertTriangle, module: "documents" },
    ],
  },
  {
    label: "Analyse",
    items: [{ to: "/statistics", label: "Statistiques", icon: BarChart3, module: "reports" }],
  },
  {
    label: "Paie & Absences",
    items: [
      { to: "/acomptes", label: "Acomptes", icon: Wallet, module: "payroll" },
      { to: "/absences", label: "Absences", icon: CalendarX, module: "leave" },
      { to: "/conges", label: "Congés", icon: CalendarRange, module: "leave" },
    ],
  },
  {
    label: "Administration",
    items: [{ to: "/admin/permissions", label: "Permissions", icon: Shield, adminOnly: true }],
  },
];

const initials = (name?: string | null) =>
  (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

interface AppSidebarProps {
  onClose?: () => void;
  /** Mode réduit : uniquement les icônes. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function AppSidebar({ onClose, collapsed = false, onToggleCollapsed }: AppSidebarProps) {
  const location = useLocation();
  const { hasPermission, isAdmin, role, user } = useAuth();

  const isVisible = (item: NavItem) => {
    if (item.adminOnly) return isAdmin();
    if (item.rhOrAdmin) return isAdmin() || role === "RH";
    if (item.module) return isAdmin() || hasPermission(item.module, "view");
    return true;
  };

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        // h-full : la barre latérale occupe la hauteur de la fenêtre et ne défile pas
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center border-b border-sidebar-border", collapsed ? "justify-center px-2 py-4" : "justify-between px-5 py-5")}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 ring-1 ring-inset ring-sidebar-primary/30">
            <img src={logoErcm} alt="ERCM" className="h-7 w-auto object-contain" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-[15px] font-bold leading-tight tracking-tight text-sidebar-primary">Rh Doc Gen</h1>
              <p className="text-[11px] text-sidebar-foreground/60">Gestion documentaire</p>
            </div>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const items = group.items.filter(isVisible);
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== "/" && location.pathname.startsWith(item.to));
                  const link = (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150",
                        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-opacity",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                        )}
                      />
                      {!collapsed && item.label}
                    </Link>
                  );

                  // En mode réduit, le libellé est remplacé par une infobulle
                  return collapsed ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Pied de page : repli + utilisateur */}
      <div className="border-t border-sidebar-border p-3">
        {onToggleCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                className={cn(
                  "mb-1 flex w-full items-center rounded-lg text-[13px] font-medium text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
                )}
              >
                <CollapseIcon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/50" />
                {!collapsed && "Réduire le menu"}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Déplier le menu</TooltipContent>}
          </Tooltip>
        )}

        <div className={cn("flex items-center rounded-lg", collapsed ? "justify-center px-0 py-2" : "gap-3 px-2 py-2")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary ring-1 ring-inset ring-sidebar-primary/30">
            {initials(user?.full_name || user?.username)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">
                {user?.full_name || user?.username || "Utilisateur"}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/50">{role}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}