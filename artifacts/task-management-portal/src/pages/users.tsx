import { useState } from "react";
import {
  useListUsers, useCreateUser, useUpdateUser,
  useGetUserPermissions, useSetUserPermission,
  useGetRolePermissions, useSetRolePermission
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Modal, Label, Select } from "@/components/ui-elements";
import { Plus, Edit2, ShieldAlert, Shield, Users as UsersIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type UsersTab = "team" | "permissions";
type PermSubTab = "by_role" | "by_user";

const DEPARTMENTS: { key: string; label: string }[] = [
  { key: "gs", label: "GS Department" },
  { key: "offer", label: "Offer Department" },
];

const PERM_COLS: { key: "can_view" | "can_edit" | "can_upload" | "can_delete"; label: string }[] = [
  { key: "can_view",   label: "VIEW"   },
  { key: "can_edit",   label: "EDIT"   },
  { key: "can_upload", label: "UPLOAD" },
  { key: "can_delete", label: "DELETE" },
];

const ROLES = [
  { key: "admin",       label: "Admin"       },
  { key: "manager",     label: "Manager"     },
  { key: "team_leader", label: "Team Leader" },
  { key: "agent",       label: "Agent"       },
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
  onToggle: (dept: string, field: "can_view" | "can_edit" | "can_upload" | "can_delete") => void;
  isLoading: boolean;
}) {
  const getPerm = (dept: string) =>
    perms?.find((p: any) => p.department === dept) ||
    { can_view: true, can_edit: true, can_delete: false, can_upload: false };

  const colAllChecked = (field: "can_view" | "can_edit" | "can_upload" | "can_delete") =>
    DEPARTMENTS.every(d => getPerm(d.key)[field]);

  const toggleAll = (field: "can_view" | "can_edit" | "can_upload" | "can_delete") => {
    const allOn = colAllChecked(field);
    DEPARTMENTS.forEach(d => {
      const p = getPerm(d.key);
      if (p[field] === allOn) onToggle(d.key, field);
    });
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary text-white">
            <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider w-56">
              Module Permission
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
            DEPARTMENTS.map((dept, i) => {
              const p = getPerm(dept.key);
              return (
                <tr key={dept.key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                  <td className="px-5 py-4 font-semibold text-slate-700">{dept.label}</td>
                  {PERM_COLS.map(col => (
                    <td key={col.key} className="px-4 py-4 text-center">
                      <MatrixCheckbox
                        checked={!!p[col.key]}
                        onChange={() => onToggle(dept.key, col.key)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function RolePermissionsMatrix() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(ROLES[0].key);
  const { data: perms, isLoading } = useGetRolePermissions(selectedRole);
  const setRolePermMut = useSetRolePermission();

  const getPerm = (dept: string) =>
    perms?.find((p: any) => p.department === dept) ||
    { can_view: true, can_edit: true, can_delete: false, can_upload: false };

  const toggle = async (dept: string, field: "can_view" | "can_edit" | "can_upload" | "can_delete") => {
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
          [field]: !p[field],
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/permissions/role/${selectedRole}`] });
      toast({ title: "Permissions updated", description: `Applied to all ${selectedRole.replace("_", " ")}s.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const roleLabel = ROLES.find(r => r.key === selectedRole)?.label || selectedRole;

  return (
    <div className="space-y-6">
      {/* Role selector */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</Label>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setSelectedRole(r.key)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium border-2 transition-colors",
                selectedRole === r.key
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border text-muted-foreground bg-card hover:border-primary/40 hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs">
        <Shield className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          These defaults apply to <strong>all {roleLabel}s</strong>.
          Individual user overrides (set via "By User") always take precedence.
        </span>
      </div>

      {/* Matrix */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Permissions</span>
        </div>
        <PermMatrix perms={perms} onToggle={toggle} isLoading={isLoading} />
      </div>
    </div>
  );
}

function UserPermissionsMatrix({ userId, userName }: { userId: number; userName: string }) {
  const queryClient = useQueryClient();
  const { data: perms, isLoading } = useGetUserPermissions(userId);
  const setPermMut = useSetUserPermission();

  const getPerm = (dept: string) =>
    perms?.find((p: any) => p.department === dept) ||
    { can_view: true, can_edit: true, can_delete: false, can_upload: false };

  const toggle = async (dept: string, field: "can_view" | "can_edit" | "can_upload" | "can_delete") => {
    const p = getPerm(dept);
    await setPermMut.mutateAsync({
      userId,
      department: dept,
      data: {
        can_view: p.can_view,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        can_upload: p.can_upload ?? false,
        [field]: !p[field],
      },
    });
    queryClient.invalidateQueries({ queryKey: [`/api/permissions/user/${userId}`] });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-base font-semibold">{userName}</div>
        <div className="text-sm text-muted-foreground mt-0.5">Individual permission overrides for this staff member.</div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Permissions</span>
        </div>
        <PermMatrix perms={perms} onToggle={toggle} isLoading={isLoading} />
      </div>
    </div>
  );
}

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<UsersTab>("team");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permSubTab, setPermSubTab] = useState<PermSubTab>("by_role");

  const createMut = useCreateUser();
  const updateMut = useUpdateUser();

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      full_name: fd.get("full_name") as string,
      email: fd.get("email") as string,
      role: fd.get("role") as string,
      is_active: fd.get("is_active") === "true",
    };
    if (fd.get("password")) data.password = fd.get("password") as string;

    if (editingItem) {
      await updateMut.mutateAsync({ userId: editingItem.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    setIsModalOpen(false);
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

  const selectedUser = users?.find(u => u.id === selectedUserId);

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    manager: "bg-indigo-100 text-indigo-700",
    team_leader: "bg-emerald-100 text-emerald-700",
    agent: "bg-slate-100 text-slate-600",
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Team Directory</h1>
            <p className="text-muted-foreground mt-1">Manage portal access, roles, and department permissions.</p>
          </div>
          {activeTab === "team" && (
            <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
              <Plus className="w-5 h-5 mr-2" />Add Team Member
            </Button>
          )}
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 border-b border-border shrink-0">
          {[
            { id: "team" as UsersTab, label: "Team Members" },
            { id: "permissions" as UsersTab, label: "Role & Permissions" },
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

        {/* ── Team Members ── */}
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
                  {isLoading ? (
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
                        <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider", roleColors[u.role] || "bg-slate-100 text-slate-600")}>
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm"
                            onClick={() => { setSelectedUserId(u.id); setPermSubTab("by_user"); setActiveTab("permissions"); }}>
                            <Shield className="w-4 h-4 mr-1" />Permissions
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingItem(u); setIsModalOpen(true); }}>
                            <Edit2 className="w-4 h-4 mr-1" />Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Role & Permissions ── */}
        {activeTab === "permissions" && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Sub-tabs */}
            <div className="flex gap-1 border-b border-border shrink-0">
              {[
                { id: "by_role" as PermSubTab, label: "By Role", icon: <UsersIcon className="w-4 h-4" /> },
                { id: "by_user" as PermSubTab, label: "By User", icon: <Shield className="w-4 h-4" /> },
              ].map(sub => (
                <button key={sub.id} onClick={() => setPermSubTab(sub.id)}
                  className={cn(
                    "px-5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                    permSubTab === sub.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}>
                  {sub.icon}{sub.label}
                </button>
              ))}
            </div>

            {/* By Role — matrix */}
            {permSubTab === "by_role" && (
              <Card className="flex-1 p-6 overflow-y-auto">
                <div className="mb-5">
                  <h3 className="font-semibold text-base">Role-Based Permissions</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set default permissions for each role. Individual overrides set via "By User" take precedence.
                  </p>
                </div>
                <RolePermissionsMatrix />
              </Card>
            )}

            {/* By User — split pane with matrix */}
            {permSubTab === "by_user" && (
              <div className="flex gap-5 flex-1 min-h-0">
                {/* Sidebar */}
                <Card className="w-60 shrink-0 flex flex-col overflow-hidden">
                  <div className="p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide border-b">
                    Select Staff Member
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {users?.map(u => (
                      <button key={u.id} onClick={() => setSelectedUserId(u.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/50",
                          selectedUserId === u.id && "bg-primary/5 border-l-2 border-l-primary"
                        )}>
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {u.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{u.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate capitalize">{u.role.replace("_", " ")}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Matrix panel */}
                <Card className="flex-1 p-6 overflow-y-auto">
                  {selectedUser ? (
                    <UserPermissionsMatrix userId={selectedUser.id} userName={selectedUser.full_name} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Shield className="w-12 h-12 mb-4 opacity-20" />
                      <p className="font-medium">Select a staff member</p>
                      <p className="text-sm mt-1">Choose from the list to manage their permissions.</p>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit User Modal */}
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
            <Select name="role" required defaultValue={editingItem?.role || "agent"}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="team_leader">Team Leader</option>
              <option value="agent">Agent</option>
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
          <div className="space-y-2">
            <Label>{editingItem ? "New Password (leave blank to keep)" : "Password *"}</Label>
            <Input name="password" type="password" required={!editingItem} placeholder="••••••••" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMut.isPending || updateMut.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
