import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Modal, Label, Select } from "@/components/ui-elements";
import { Plus, Edit2, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export default function Users() {
  const { isAdminOrManager } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const createMut = useCreateUser();
  const updateMut = useUpdateUser();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      full_name: fd.get("full_name") as string,
      email: fd.get("email") as string,
      role: fd.get("role") as string,
    };
    if (fd.get("password")) {
      data.password = fd.get("password") as string;
    }

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

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Team Directory</h1>
            <p className="text-muted-foreground mt-1">Manage portal access and user roles.</p>
          </div>
          <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
            <Plus className="w-5 h-5 mr-2" />
            Add Team Member
          </Button>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="table-container flex-1 h-full border-0 rounded-none">
            <table className="spreadsheet-table w-full h-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
                ) : users?.map(u => (
                  <tr key={u.id}>
                    <td className="font-semibold text-foreground flex items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold mr-3">
                        {u.full_name.charAt(0)}
                      </div>
                      {u.full_name}
                    </td>
                    <td className="text-muted-foreground">{u.email}</td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'manager' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingItem(u); setIsModalOpen(true); }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit User" : "New User"}>
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
              <option value="agent">Agent</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{editingItem ? "New Password (leave blank to keep current)" : "Password *"}</Label>
            <Input name="password" type="password" required={!editingItem} placeholder="••••••••" />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMut.isPending || updateMut.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
