import React, { useState, useRef } from "react";
import {
  useListUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useGetRolePermissions, useSetRolePermission,
  useListRoles, useCreateRole, useUpdateRole, useDeleteRole,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Modal, Label, Select } from "@/components/ui-elements";
import { Plus, Edit2, ShieldAlert, Shield, Users as UsersIcon, Trash2, Pencil, Check, X, LogIn, LogOut, Monitor, AlertTriangle, Lock, Clock } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/lib/permission-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type UsersTab = "team" | "permissions" | "audit";

const DEPARTMENTS: { key: string; label: string; group?: string }[] = [
  { key: "gs",           label: "GS Applications",      group: "Departments" },
  { key: "offer",        label: "Offer Applications",    group: "Departments" },
  { key: "my_tasks",     label: "My Tasks",              group: "Modules" },
  { key: "students",     label: "Students Directory",    group: "Modules" },
  { key: "reports",      label: "Performance Reports",   group: "Modules" },
  { key: "agents",       label: "External Agents",       group: "Modules" },
  { key: "users",        label: "Team Directory",        group: "Modules" },
  { key: "leave",        label: "Leave & Availability",  group: "Modules" },
  { key: "settings",     label: "System Settings",       group: "Modules" },
];

const PERM_COLS: { key: "can_view" | "can_edit" | "can_upload" | "can_delete" | "can_view_all_users" | "can_view_mapped_users"; label: string; title?: string }[] = [
  { key: "can_view",              label: "VIEW"       },
  { key: "can_edit",              label: "EDIT"       },
  { key: "can_upload",            label: "UPLOAD"     },
  { key: "can_delete",            label: "DELETE"     },
  { key: "can_view_all_users",    label: "ALL USERS",  title: "Can see all users in the Assigned To filter" },
  { key: "can_view_mapped_users", label: "MY TEAM",    title: "Can see only their team (same manager) in the Assigned To filter" },
];

function MatrixCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto",
        checked
          ? "bg-primary border-primary"
          : "bg-white border-slate-300 hover:border-primary/60"
      )}
      aria-checked={checked}
    >
      {checked && (
        <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function PermMatrix({
  perms,
  onToggle,
  isLoading,
}: {
  perms: any[] | undefined;
  onToggle: (dept: string, field: "can_view" | "can_edit" | "can_upload" | "can_delete" | "can_view_all_users" | "can_view_mapped_users") => void;
  isLoading: boolean;
}) {
  const getPerm = (dept: string) =>
    perms?.find((p: any) => p.department === dept) ||
    { can_view: false, can_edit: false, can_delete: false, can_upload: false, can_view_all_users: false, can_view_mapped_users: false };

  const colAllChecked = (field: "can_view" | "can_edit" | "can_upload" | "can_delete" | "can_view_all_users" | "can_view_mapped_users") =>
    DEPARTMENTS.every(d => getPerm(d.key)[field]);

  const toggleAll = (field: "can_view" | "can_edit" | "can_upload" | "can_delete" | "can_view_all_users" | "can_view_mapped_users") => {
    const allOn = colAllChecked(field);
    DEPARTMENTS.forEach(d => {
      const p = getPerm(d.key);
      if (p[field] === allOn) onToggle(d.key, field);
    });
  };

  // Build rows with group header rows interspersed
  const groups = Array.from(new Set(DEPARTMENTS.map(d => d.group)));

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary text-white">
            <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider w-56">
              Department / Module
            </th>
            {PERM_COLS.map(col => (
              <th key={col.key} className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                <div className="flex flex-col items-center gap-1.5">
                  <MatrixCheckbox
                    checked={!isLoading && colAllChecked(col.key)}
                    onChange={() => toggleAll(col.key)}
                  />
                  <span>{col.label}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={5} className="text-center py-10 text-muted-foreground">Loading permissions...</td>
            </tr>
          ) : (
            groups.map(group => {
              const groupDepts = DEPARTMENTS.filter(d => d.group === group);
              return [
                <tr key={`group-${group}`}>
                  <td colSpan={5} className="bg-slate-100 px-5 py-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{group}</span>
                  </td>
                </tr>,
                ...groupDepts.map((dept, i) => {
                  const p = getPerm(dept.key);
                  return (
                    <tr key={dept.key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">{dept.label}</td>
                      {PERM_COLS.map(col => (
                        <td key={col.key} className="px-4 py-3.5 text-center">
                          <MatrixCheckbox
                            checked={!!p[col.key]}
                            onChange={() => onToggle(dept.key, col.key)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                }),
              ];
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function RolePermissionsPanel({ roles }: { roles: any[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.name || "");
  const { data: perms, isLoading } = useGetRolePermissions(selectedRole);
  const setRolePermMut = useSetRolePermission();

  const getPerm = (dept: string) =>
    perms?.find((p: any) => p.department === dept) ||
    { can_view: false, can_edit: false, can_delete: false, can_upload: false, can_view_all_users: false, can_view_mapped_users: false };

  const toggle = async (dept: string, field: "can_view" | "can_edit" | "can_upload" | "can_delete" | "can_view_all_users" | "can_view_mapped_users") => {
    const p = getPerm(dept);
    try {
      await setRolePermMut.mutateAsync({
        role: selectedRole,
        department: dept,
        data: {
          can_view: p.can_view,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
          can_upload: p.can_upload ?? false,
          can_view_all_users: p.can_view_all_users ?? false,
          can_view_mapped_users: p.can_view_mapped_users ?? false,
          [field]: !p[field],
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/permissions/role/${selectedRole}`] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  if (!selectedRole && roles.length > 0) {
    setSelectedRole(roles[0].name);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Role</Label>
        <div className="flex flex-wrap gap-2">
          {roles.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRole(r.name)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium border-2 transition-colors",
                selectedRole === r.name
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border text-muted-foreground bg-card hover:border-primary/40 hover:text-foreground"
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {selectedRole && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Permissions for <span className="text-foreground">{selectedRole}</span>
            </span>
          </div>
          <PermMatrix perms={perms} onToggle={toggle} isLoading={isLoading} />
        </div>
      )}

      {roles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No roles yet. Create a role first.</p>
        </div>
      )}
    </div>
  );
}

function RoleManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roles, isLoading } = useListRoles();
  const createMut = useCreateRole();
  const updateMut = useUpdateRole();
  const deleteMut = useDeleteRole();

  const [newRoleName, setNewRoleName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const newRoleInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    try {
      await createMut.mutateAsync({ name });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setNewRoleName("");
      toast({ title: "Role created", description: `"${name}" added.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || e.detail || "Could not create role" });
    }
  };

  const handleRename = async (roleId: number) => {
    const name = editingName.trim();
    if (!name) return;
    try {
      await updateMut.mutateAsync({ roleId, data: { name } });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingId(null);
      toast({ title: "Role renamed", description: `Renamed to "${name}".` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || e.detail || "Could not rename role" });
    }
  };

  const handleDelete = async (roleId: number) => {
    try {
      await deleteMut.mutateAsync(roleId);
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setDeleteConfirmId(null);
      toast({ title: "Role deleted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Cannot delete", description: e.message || e.detail || "Could not delete role" });
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          ref={newRoleInputRef}
          value={newRoleName}
          onChange={e => setNewRoleName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()}
          placeholder="New role name (e.g. GS Staff, Offer Staff)"
          className="max-w-xs"
        />
        <Button onClick={handleCreate} disabled={!newRoleName.trim() || createMut.isPending} size="sm">
          <Plus className="w-4 h-4 mr-1" />Add Role
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading roles...</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Role Name</th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {roles?.map(role => (
                <tr key={role.id} className="bg-white hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    {editingId === role.id ? (
                      <Input
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRename(role.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="max-w-xs h-8 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{role.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirmId === role.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-destructive font-medium">Delete &quot;{role.name}&quot;?</span>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(role.id)} disabled={deleteMut.isPending}>
                          <Check className="w-3.5 h-3.5 mr-1" />Yes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)}>
                          <X className="w-3.5 h-3.5 mr-1" />No
                        </Button>
                      </div>
                    ) : editingId === role.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" onClick={() => handleRename(role.id)} disabled={updateMut.isPending}>
                          <Check className="w-3.5 h-3.5 mr-1" />Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5 mr-1" />Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(role.id); setEditingName(role.name); }}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />Rename
                        </Button>
                        {role.name !== "admin" && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(role.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!roles?.length && (
                <tr>
                  <td colSpan={2} className="text-center py-8 text-muted-foreground">No roles yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function parseDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const s = ua.toLowerCase();
  let os = "Unknown OS";
  if (s.includes("windows"))     os = "Windows";
  else if (s.includes("mac os")) os = "macOS";
  else if (s.includes("iphone")) os = "iPhone";
  else if (s.includes("ipad"))   os = "iPad";
  else if (s.includes("android")) os = "Android";
  else if (s.includes("linux"))  os = "Linux";
  let browser = "Unknown Browser";
  if (s.includes("edg/"))        browser = "Edge";
  else if (s.includes("chrome")) browser = "Chrome";
  else if (s.includes("firefox")) browser = "Firefox";
  else if (s.includes("safari")) browser = "Safari";
  else if (s.includes("opera"))  browser = "Opera";
  return `${browser} on ${os}`;
}

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  login:          { label: "Login",          icon: <LogIn className="w-3.5 h-3.5" />,       cls: "bg-green-100 text-green-700"  },
  logout:         { label: "Logout",         icon: <LogOut className="w-3.5 h-3.5" />,      cls: "bg-slate-100 text-slate-600"  },
  login_failed:   { label: "Failed Login",   icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: "bg-red-100 text-red-700"   },
  login_blocked:  { label: "Blocked",        icon: <Lock className="w-3.5 h-3.5" />,        cls: "bg-orange-100 text-orange-700"},
  account_locked: { label: "Account Locked", icon: <Lock className="w-3.5 h-3.5" />,        cls: "bg-red-100 text-red-700"     },
  otp_sent:       { label: "OTP Sent",       icon: <Clock className="w-3.5 h-3.5" />,       cls: "bg-blue-100 text-blue-700"   },
  change_password:{ label: "Password Changed", icon: <Shield className="w-3.5 h-3.5" />,   cls: "bg-purple-100 text-purple-700"},
};

function LoginAuditPanel({ users }: { users: any[] }) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(users[0]?.id ?? null);
  const token = localStorage.getItem("access_token");

  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/audit/logs", selectedUserId],
    enabled: selectedUserId !== null,
    queryFn: async () => {
      const url = selectedUserId
        ? `/api/audit/logs?user_id=${selectedUserId}&limit=200`
        : `/api/audit/logs?limit=200`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="flex flex-1 gap-4 min-h-0">
      {/* User list */}
      <Card className="w-56 shrink-0 flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border shrink-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Members</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors border-b border-border/40 last:border-0",
                selectedUserId === u.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-accent text-foreground"
              )}
            >
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                {u.full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{u.full_name}</div>
                <div className="truncate text-[11px] text-muted-foreground capitalize">{u.role.replace("_", " ")}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Logs area */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {selectedUser ? `Login & Device Audit — ${selectedUser.full_name}` : "Login & Device Audit"}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Monitor className="w-10 h-10 opacity-20" />
              <p className="text-sm">No login activity recorded yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-500">Date & Time</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-500">Event</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-500">IP Address</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-500">Device / Browser</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-500">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => {
                  const meta = ACTION_META[log.action] || { label: log.action, icon: <Clock className="w-3.5 h-3.5" />, cls: "bg-slate-100 text-slate-600" };
                  const dt = new Date(log.created_at + "Z");
                  return (
                    <tr key={log.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", meta.cls)}>
                          {meta.icon}{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{log.ip_address || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{parseDevice(log.user_agent)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{log.detail || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading: usersLoading } = useListUsers();
  const { data: roles } = useListRoles();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [activeTab, setActiveTab] = useState<UsersTab>("team");
  const [permSection, setPermSection] = useState<"matrix" | "roles">("matrix");

  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const deleteUserMut = useDeleteUser();
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<number | null>(null);
  const { toast } = useToast();

  const handleDeleteUser = async (userId: number) => {
    try {
      await deleteUserMut.mutateAsync({ userId });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteConfirmUserId(null);
      toast({ title: "Team member deleted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Cannot delete", description: e.message || "Could not delete user" });
      setDeleteConfirmUserId(null);
    }
  };

  const { isCustomRole, canView } = usePermissions();
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager" || (isCustomRole && canView("users"));
  const isAdmin = user?.role === "admin";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const managerIdRaw = fd.get("manager_id") as string;
    const data: any = {
      full_name: fd.get("full_name") as string,
      email: fd.get("email") as string,
      role: fd.get("role") as string,
      is_active: fd.get("is_active") === "true",
      manager_id: managerIdRaw ? Number(managerIdRaw) : null,
    };
    if (fd.get("password")) data.password = fd.get("password") as string;

    try {
      if (editingItem) {
        await updateMut.mutateAsync({ userId: editingItem.id, data });
      } else {
        await createMut.mutateAsync({ data });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Could not save user" });
    }
  };

  if (!isAdminOrManager) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2 max-w-md">You do not have administrative permissions to view or manage the team directory.</p>
        </div>
      </Layout>
    );
  }

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    manager: "bg-indigo-100 text-indigo-700",
    team_leader: "bg-emerald-100 text-emerald-700",
    agent: "bg-slate-100 text-slate-600",
  };

  const getRoleColor = (role: string) => roleColors[role] || "bg-blue-100 text-blue-700";

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Team Directory</h1>
            <p className="text-muted-foreground mt-1">Manage portal access, roles, and department permissions.</p>
          </div>
          {activeTab === "team" && (
            <Button onClick={() => { setEditingItem(null); setShowPasswordReset(false); setIsModalOpen(true); }}>
              <Plus className="w-5 h-5 mr-2" />Add Team Member
            </Button>
          )}
        </div>

        <div className="flex gap-1 border-b border-border shrink-0">
          {[
            { id: "team" as UsersTab, label: "Team Members" },
            { id: "permissions" as UsersTab, label: "Role & Permissions" },
            ...(isAdmin ? [{ id: "audit" as UsersTab, label: "Login Audit" }] : []),
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "team" && (
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="table-container flex-1 h-full border-0 rounded-none">
              <table className="spreadsheet-table w-full h-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Account</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
                  ) : users?.map(u => (
                    <tr key={u.id}>
                      <td className="font-semibold text-foreground">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold mr-3">
                            {u.full_name.charAt(0)}
                          </div>
                          {u.full_name}
                        </div>
                      </td>
                      <td className="text-muted-foreground">{u.email}</td>
                      <td>
                        <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider", getRoleColor(u.role))}>
                          {u.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        {deleteConfirmUserId === u.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-destructive font-medium">Delete {u.full_name.split(" ")[0]}?</span>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(u.id)} disabled={deleteUserMut.isPending}>
                              <Check className="w-3.5 h-3.5 mr-1" />Yes
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDeleteConfirmUserId(null)}>
                              <X className="w-3.5 h-3.5 mr-1" />No
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingItem(u); setShowPasswordReset(false); setIsModalOpen(true); }}>
                              <Edit2 className="w-4 h-4 mr-1" />Edit
                            </Button>
                            {isAdmin && user?.id !== u.id && (
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmUserId(u.id)}>
                                <Trash2 className="w-4 h-4 mr-1" />Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "permissions" && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Section toggle */}
            <div className="flex gap-1 border-b border-border shrink-0">
              {[
                { id: "matrix" as const, label: "Permission Matrix", icon: <Shield className="w-4 h-4" /> },
                ...(isAdmin ? [{ id: "roles" as const, label: "Manage Roles", icon: <UsersIcon className="w-4 h-4" /> }] : []),
              ].map(sec => (
                <button key={sec.id} onClick={() => setPermSection(sec.id)}
                  className={cn(
                    "px-5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                    permSection === sec.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}>
                  {sec.icon}{sec.label}
                </button>
              ))}
            </div>

            {permSection === "matrix" && (
              <Card className="flex-1 p-6 overflow-y-auto">
                <div className="mb-5">
                  <h3 className="font-semibold text-base">Role Permissions</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a role and manually configure what each role can do. What you set here is final — no automatic defaults or overrides.
                  </p>
                </div>
                {roles && roles.length > 0 ? (
                  <RolePermissionsPanel roles={roles} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No roles found. Go to <strong>Manage Roles</strong> to create roles first.</p>
                  </div>
                )}
              </Card>
            )}

            {permSection === "roles" && isAdmin && (
              <Card className="flex-1 p-6 overflow-y-auto">
                <div className="mb-5">
                  <h3 className="font-semibold text-base">Manage Roles</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create, rename, or delete roles. Each user is assigned one role. The <strong>admin</strong> role cannot be deleted.
                  </p>
                </div>
                <RoleManager />
              </Card>
            )}
          </div>
        )}

        {activeTab === "audit" && isAdmin && (
          <LoginAuditPanel users={users || []} />
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit User" : "New Team Member"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input name="full_name" required defaultValue={editingItem?.full_name || ""} />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input name="email" type="email" required defaultValue={editingItem?.email || ""} />
          </div>
          <div className="space-y-2">
            <Label>Role *</Label>
            <Select name="role" required defaultValue={editingItem?.role || roles?.[0]?.name || ""}>
              {roles?.map(r => (
                <option key={r.id} value={r.name}>{r.name.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reports To (Manager)</Label>
            <Select name="manager_id" defaultValue={editingItem?.manager_id ?? ""}>
              <option value="">— No Manager —</option>
              {users?.filter(u => u.id !== editingItem?.id).map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
              ))}
            </Select>
          </div>
          {editingItem && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="is_active" defaultValue={editingItem.is_active ? "true" : "false"}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </div>
          )}
          {editingItem ? (
            <div className="space-y-2">
              {!showPasswordReset ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-sm text-primary underline underline-offset-2 hover:opacity-75"
                >
                  Change password
                </button>
              ) : (
                <>
                  <Label>New Password *</Label>
                  <Input
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(false)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:opacity-75"
                  >
                    Cancel password change
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Enter password"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMut.isPending || updateMut.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
