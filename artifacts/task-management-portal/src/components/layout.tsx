import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Files, 
  CheckCircle, 
  Users, 
  GraduationCap, 
  Building2, 
  Settings, 
  LogOut,
  Menu,
  Briefcase,
  FileCheck2,
  Globe,
  BarChart3,
  UserCheck,
  Calendar
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui-elements";

interface NavGroup {
  label: string;
  items: {
    href: string;
    label: string;
    icon: any;
    roles: string[];
  }[];
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navGroups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "agent"] },
        { href: "/my-tasks", label: "My Tasks", icon: Briefcase, roles: ["admin", "manager", "agent"] },
      ],
    },
    {
      label: "GS Department",
      items: [
        { href: "/applications", label: "GS Applications", icon: Files, roles: ["admin", "manager", "agent"] },
        { href: "/approved", label: "Approved Students", icon: CheckCircle, roles: ["admin", "manager", "agent"] },
      ],
    },
    {
      label: "Offer Department",
      items: [
        { href: "/offer-applications", label: "Offer Applications", icon: FileCheck2, roles: ["admin", "manager", "agent"] },
      ],
    },
    {
      label: "Management",
      items: [
        { href: "/reports", label: "Performance Reports", icon: BarChart3, roles: ["admin", "manager"] },
        { href: "/agents", label: "External Agents", icon: UserCheck, roles: ["admin", "manager"] },
        { href: "/students", label: "Students Directory", icon: GraduationCap, roles: ["admin", "manager", "agent"] },
        { href: "/universities", label: "Universities", icon: Building2, roles: ["admin", "manager", "agent"] },
        { href: "/users", label: "Team Directory", icon: Users, roles: ["admin", "manager"] },
        { href: "/leave", label: "Leave & Availability", icon: Calendar, roles: ["admin", "manager"] },
        { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "manager"] },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);
  const currentLabel = allNavItems.find((i) => i.href === location)?.label || "Portal";

  const renderLink = (item: { href: string; label: string; icon: any; roles: string[] }) => {
    if (!user || !item.roles.includes(user.role)) return null;
    const Icon = item.icon;
    const isActive = location === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group font-medium text-sm",
          isActive
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <Icon className={cn("w-5 h-5 mr-3 transition-colors shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:flex-shrink-0 shadow-xl lg:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50 bg-black/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center mr-3 shadow-lg">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-display font-bold text-lg tracking-wide text-white">GlobalStudy</h1>
        </div>

        <nav className="flex-1 py-5 px-4 overflow-y-auto space-y-5">
          {navGroups.map((group) => {
            const visibleLinks = group.items.filter(
              (item) => user && item.roles.includes(user.role)
            );
            if (visibleLinks.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-2 px-3">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {visibleLinks.map(renderLink)}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50 bg-black/10">
          <div className="flex items-center mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold mr-3 border border-primary/20 shrink-0">
              {user?.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center">
            <button
              className="lg:hidden p-2 rounded-md hover:bg-muted text-muted-foreground mr-2"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="font-display font-semibold text-lg hidden sm:block">{currentLabel}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground hidden md:inline-flex items-center bg-muted px-3 py-1 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              System Online
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-background/50 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto p-4 lg:p-8">
            <div className="max-w-[1600px] mx-auto h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
