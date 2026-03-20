import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useChangePassword } from "@workspace/api-client-react";
import {
  LayoutDashboard, Files, CheckCircle, Users, GraduationCap,
  Building2, Settings, LogOut, Menu, Briefcase, FileCheck2,
  Globe, BarChart3, UserCheck, Calendar, KeyRound, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, Label, Modal } from "./ui-elements";
import { useToast } from "@/hooks/use-toast";

const IDLE_TIMEOUT_MS  = 30 * 60 * 1000;  // 30 minutes
const WARN_BEFORE_MS   =  5 * 60 * 1000;  // warn at 25 minutes
const WARN_DURATION_MS =  5 * 60 * 1000;  // countdown lasts 5 minutes

interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: any; roles: string[] }[];
}

// ─── Inactivity guard ────────────────────────────────────────────────────────

function useInactivityLogout(logout: () => void) {
  const [warnVisible, setWarnVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = useCallback(() => {
    if (idleTimer.current)  clearTimeout(idleTimer.current);
    if (warnTimer.current)  clearTimeout(warnTimer.current);
    if (countTimer.current) clearInterval(countTimer.current);
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setWarnVisible(false);

    warnTimer.current = setTimeout(() => {
      setSecondsLeft(Math.round(WARN_DURATION_MS / 1000));
      setWarnVisible(true);
      countTimer.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(countTimer.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    idleTimer.current = setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT_MS);
  }, [clearAll, logout]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => reset();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearAll();
    };
  }, [reset, clearAll]);

  const stayLoggedIn = useCallback(() => {
    reset();
  }, [reset]);

  return { warnVisible, secondsLeft, stayLoggedIn };
}

// ─── Change password modal ───────────────────────────────────────────────────

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError]     = useState("");
  const { toast } = useToast();
  const mut = useChangePassword();

  const reset = () => { setCurrent(""); setNext(""); setConfirm(""); setError(""); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 6) { setError("New password must be at least 6 characters"); return; }
    if (next !== confirm) { setError("Passwords do not match"); return; }
    try {
      await mut.mutateAsync({ current_password: current, new_password: next });
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      handleClose();
    } catch (err: any) {
      setError(err.message || "Could not change password. Check your current password.");
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>
        )}
        <div className="space-y-2">
          <Label>Current Password</Label>
          <Input type="password" required value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="space-y-2">
          <Label>New Password</Label>
          <Input type="password" required minLength={6} value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="space-y-2">
          <Label>Confirm New Password</Label>
          <Input type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)}
            className={cn(confirm && confirm !== next && "border-destructive")} placeholder="••••••••" />
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="submit" isLoading={mut.isPending}>Update Password</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Inactivity warning modal ────────────────────────────────────────────────

function InactivityWarning({
  visible, secondsLeft, onStay, onLogout,
}: { visible: boolean; secondsLeft: number; onStay: () => void; onLogout: () => void }) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <Modal isOpen={visible} onClose={onStay} title="">
      <div className="text-center py-4 space-y-5">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-1">Still there?</h3>
          <p className="text-muted-foreground text-sm">
            You'll be signed out in
          </p>
          <div className="text-4xl font-mono font-bold text-amber-500 mt-2">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <p className="text-muted-foreground text-xs mt-1">due to inactivity</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={onStay} className="px-8">Stay Signed In</Button>
          <Button variant="outline" onClick={onLogout}>Sign Out Now</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Layout ─────────────────────────────────────────────────────────────

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);

  const { warnVisible, secondsLeft, stayLoggedIn } = useInactivityLogout(logout);

  const navGroups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { href: "/",        label: "Dashboard",  icon: LayoutDashboard, roles: ["admin", "manager", "agent"] },
        { href: "/my-tasks", label: "My Tasks",  icon: Briefcase,       roles: ["admin", "manager", "agent"] },
      ],
    },
    {
      label: "GS Department",
      items: [
        { href: "/applications", label: "GS Applications", icon: Files, roles: ["admin", "manager", "agent"] },
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
        { href: "/reports",      label: "Performance Reports",  icon: BarChart3,    roles: ["admin", "manager"] },
        { href: "/agents",       label: "External Agents",      icon: UserCheck,    roles: ["admin", "manager"] },
        { href: "/students",     label: "Students Directory",   icon: GraduationCap, roles: ["admin", "manager", "agent"] },
        { href: "/universities", label: "Universities",         icon: Building2,    roles: ["admin", "manager", "agent"] },
        { href: "/users",        label: "Team Directory",       icon: Users,        roles: ["admin", "manager"] },
        { href: "/leave",        label: "Leave & Availability", icon: Calendar,     roles: ["admin", "manager"] },
        { href: "/settings",     label: "Settings",             icon: Settings,     roles: ["admin", "manager"] },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap(g => g.items);
  const currentLabel = allNavItems.find(i => i.href === location)?.label || "Portal";

  const renderLink = (item: { href: string; label: string; icon: any; roles: string[] }) => {
    if (!user || !item.roles.includes(user.role)) return null;
    const Icon = item.icon;
    const isActive = location === item.href;
    return (
      <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group font-medium text-sm",
          isActive
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}>
        <Icon className={cn("w-5 h-5 mr-3 transition-colors shrink-0",
          isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
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
          <h1 className="font-display font-bold text-sm tracking-wide text-white leading-tight">
            Admission Task<br/>Management
          </h1>
        </div>

        <nav className="flex-1 py-5 px-4 overflow-y-auto space-y-5">
          {navGroups.map(group => {
            const visible = group.items.filter(item => user && item.roles.includes(user.role));
            if (!visible.length) return null;
            return (
              <div key={group.label}>
                <div className="text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-2 px-3">
                  {group.label}
                </div>
                <div className="space-y-0.5">{visible.map(renderLink)}</div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50 bg-black/10">
          <div className="flex items-center mb-3 px-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold mr-3 border border-primary/20 shrink-0">
              {user?.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => setChangePwOpen(true)}
            className="w-full flex items-center px-3 py-2 rounded-xl text-sidebar-foreground/60 hover:bg-white/5 hover:text-white transition-colors font-medium text-sm mb-1"
          >
            <KeyRound className="w-4 h-4 mr-3" />
            Change Password
          </button>
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
            <button className="lg:hidden p-2 rounded-md hover:bg-muted text-muted-foreground mr-2"
              onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="font-display font-semibold text-lg hidden sm:block">{currentLabel}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:inline-flex items-center bg-muted px-3 py-1 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />System Online
            </span>
            <button
              onClick={() => setChangePwOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors hover:border-primary/40"
            >
              <KeyRound className="w-3.5 h-3.5" />Change Password
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-background/50 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-8">
            <div className="max-w-[1600px] mx-auto h-full">
              {children}
            </div>
          </div>
        </main>
      </div>

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
      <InactivityWarning
        visible={warnVisible}
        secondsLeft={secondsLeft}
        onStay={stayLoggedIn}
        onLogout={logout}
      />
    </div>
  );
}
