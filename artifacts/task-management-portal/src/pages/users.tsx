import { useState } from "react";
import {
  useListUsers, useCreateUser, useUpdateUser,
  useGetUserPermissions, useSetUserPermission,
  useGetRolePermissions, useSetRolePermission
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Modal, Label, Select } from "@/components/ui-elements";
import { Plus, Edit2, ShieldAlert, Shield, Check, X, Users as UsersIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type UsersTab = "team" | "permissions";
type PermSubTab = "by_user" | "by_role";

const DEPARTMENTS = ["gs", "offer"];
const ROLES = ["admin", "manager", "team_leader", "agent"];

function PermissionsPanel({ userId, userName }: { userId: number; userName: string }) {
  const queryClient = useQueryClient();
  const { data: perms, isLoading } = useGetUserPermissions(userId);
  const setPermMut = useSetUserPermission();

  const getPerm = (dept: string) => perms?.find(p => p.department === dept);

  const toggle = async (dept: string, field: "can_view" | "can_edit" | "can_delete" | "can_upload") => {
    const p = getPerm(dept) || { can_view: true, can_edit: true, can_delete: false, can_upload: false };
    await setPermMut.mutateAsync({
      userId,
      department: dept,
      data: { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete, can_upload: p.can_upload ?? false, [field]: !(p as any)[field] }
    });
    queryClient.invalidateQueries({ queryKey: [`/api/permissions/user/${userId}`] });
  };

  if (isLoading) return <div className="py-4 text-center text-muted-foreground">Loading permissions...</div>;

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-muted-foreground mb-2">Permissions for: {userName}</div>
      <div className="grid grid-cols-1 gap-3">
        {DEPARTMENTS.map(dept => {
          const p = getPerm(dept) || { can_view: true, can_edit: true, can_delete: false, can_upload: false };
          const label = dept === "gs" ? "GS Department" : "Offer Department";
          return (
            <div key={dept} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
              <div className="w-36 font-semibold text-sm">{label}</div>
              {permFields.map(({ key, label: permLabel }) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => toggle(dept, key)}
                    className={cn(
                      "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors",
                      (p as any)[key] ? "border-primary bg-primary text-white" : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {(p as any)[key] ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                  <span className="text-xs text-muted-foreground">{permLabel}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        <strong>View</strong> — access the section. <strong>Edit</strong> — create & modify records. <strong>Upload</strong> — bulk upload files. <strong>Delete</strong> — remove records permanently.
      </p>
    </div>
  );
}

const permFields: { key: "can_view" | "can_edit" | "can_delete" | "can_upload"; label: string }[] = [
  { key: "can_view", label: "View" },
  { key: "can_edit", label: "Edit" },
  { key: "can_upload", label: "Upload" },
  { key: "can_delete", label: "Delete" },
];

function RolePermissionsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(ROLES[0]);
  const { data: perms, isLoading } = useGetRolePermissions(selectedRole);
  const setRolePermMut = useSetRolePermission();

  const getPerm = (dept: string) => perms?.find((p: any) => p.department === dept);

  const toggle = async (dept: string, field: "can_view" | "can_edit" | "can_delete" | "can_upload") => {
    const p = getPerm(dept) || { can_view: true, can_edit: true, can_delete: false, can_upload: false };
    try {
      await setRolePermMut.mutateAsync({
        role: selectedRole,
        department: dept,
        data: { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete, can_upload: p.can_upload ?? false, [field]: !(p as any)[field] }
      });
      queryClient.invalidateQueries({ queryKey: [`/api/permissions/role/${selectedRole}`] });
      toast({ title: "Role permissions updated", description: `Applied to all ${selectedRole}s.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex gap-2 flex-wrap">
          {ROLES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRole(r)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium border-2 capitalize transition-colors",
                selectedRole === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {r.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
          Changes here apply to <strong>all users</strong> with the <strong>{selectedRole.replace("_", " ")}</strong> role. Individual user overrides (set via "By User") take precedence.
        </p>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-muted-foreground">Loading role permissions...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {DEPARTMENTS.map(dept => {
            const p = getPerm(dept) || { can_view: true, can_edit: true, can_delete: false, can_upload: false };
            const label = dept === "gs" ? "GS Department" : "Offer Department";
            return (
              <div key={dept} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
                <div className="w-36 font-semibold text-sm">{label}</div>
                {permFields.map(({ key, label: permLabel }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => toggle(dept, key)}
                      className={cn(
                        "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors",
                        (p as any)[key] ? "border-primary bg-primary text-white" : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      {(p as any)[key] ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <span className="text-xs text-muted-foreground">{permLabel}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        <strong>View</strong> — access the section. <strong>Edit</strong> — create & modify records. <strong>Upload</strong> — bulk upload files. <strong>Delete</strong> — remove records permanently.
      </p>
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
  const [permSubTab, setPermSubTab] = useState<PermSubTab>("by_user");

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

        <div className="flex gap-1 border-b border-border shrink-0">
          {[
            { id: "team" as UsersTab, label: "Team Members" },
            { id: "permissions" as UsersTab, label: "Role & Permissions" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
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
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(u.id); setActiveTab("permissions"); }}>
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

        {activeTab === "permissions" && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Sub-tab switcher */}
            <div className="flex gap-1 border-b border-border shrink-0">
              {[
                { id: "by_user" as PermSubTab, label: "By User", icon: <Shield className="w-4 h-4" /> },
                { id: "by_role" as PermSubTab, label: "By Role", icon: <UsersIcon className="w-4 h-4" /> },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setPermSubTab(sub.id)}
                  className={cn(
                    "px-5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                    permSubTab === sub.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {sub.icon}{sub.label}
                </button>
              ))}
            </div>

            {permSubTab === "by_user" && (
              <div className="flex gap-6 flex-1 min-h-0">
                <Card className="w-64 shrink-0 flex flex-col overflow-hidden">
                  <div className="p-4 font-semibold text-sm text-muted-foreground border-b">Select Staff Member</div>
                  <div className="flex-1 overflow-y-auto">
                    {users?.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/50",
                          selectedUserId === u.id && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{u.full_name.charAt(0)}</div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{u.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
                <Card className="flex-1 p-6 overflow-y-auto">
                  {selectedUser ? (
                    <PermissionsPanel userId={selectedUser.id} userName={selectedUser.full_name} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Shield className="w-12 h-12 mb-4 opacity-30" />
                      <p>Select a staff member to manage their department access.</p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {permSubTab === "by_role" && (
              <Card className="flex-1 p-6 overflow-y-auto">
                <div className="mb-4">
                  <h3 className="font-semibold text-base">Role-Based Permissions</h3>
                  <p className="text-sm text-muted-foreground mt-1">Set default permissions for an entire role. These apply to all users with that role unless overridden at the user level.</p>
                </div>
                <RolePermissionsPanel />
              </Card>
            )}
          </div>
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
