import { useState } from "react";
import { useListStudents, useCreateStudent, useUpdateStudent } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Modal, Label } from "@/components/ui-elements";
import { Search, Plus, UserCircle, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Students() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: students, isLoading } = useListStudents({ search: search || undefined });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const createMut = useCreateStudent();
  const updateMut = useUpdateStudent();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      full_name: fd.get("full_name") as string,
      email: fd.get("email") as string,
      phone: fd.get("phone") as string,
      passport_no: fd.get("passport_no") as string,
      dob: fd.get("dob") as string || undefined,
    };

    if (editingItem) {
      await updateMut.mutateAsync({ studentId: editingItem.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/students"] });
    setIsModalOpen(false);
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Students Directory</h1>
          </div>
          <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
            <Plus className="w-5 h-5 mr-2" />
            Add Student
          </Button>
        </div>

        <Card className="p-4 bg-muted/30 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              placeholder="Search by name..." 
              className="pl-10 bg-card"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </Card>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="table-container flex-1 h-full border-0 rounded-none">
            <table className="spreadsheet-table w-full h-full">
              <thead>
                <tr>
                  <th className="w-16">Profile</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Passport No</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
                ) : students?.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <UserCircle className="w-5 h-5" />
                      </div>
                    </td>
                    <td className="font-semibold text-foreground">{s.full_name}</td>
                    <td className="text-muted-foreground">{s.email || '-'}</td>
                    <td className="text-muted-foreground">{s.phone || '-'}</td>
                    <td className="font-mono text-sm text-slate-500">{s.passport_no || '-'}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingItem(s); setIsModalOpen(true); }}>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Student" : "New Student"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input name="full_name" required defaultValue={editingItem?.full_name || ""} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input name="email" type="email" defaultValue={editingItem?.email || ""} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input name="phone" defaultValue={editingItem?.phone || ""} />
          </div>
          <div className="space-y-2">
            <Label>Passport Number</Label>
            <Input name="passport_no" defaultValue={editingItem?.passport_no || ""} />
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input name="dob" type="date" defaultValue={editingItem?.dob || ""} />
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
