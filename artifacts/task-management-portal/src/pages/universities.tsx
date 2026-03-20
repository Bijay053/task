import { useState } from "react";
import { useListUniversities, useCreateUniversity, useUpdateUniversity } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Modal, Label } from "@/components/ui-elements";
import { Search, Plus, Building, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Universities() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: universities, isLoading } = useListUniversities({ search: search || undefined });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const createMut = useCreateUniversity();
  const updateMut = useUpdateUniversity();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      country: fd.get("country") as string,
    };

    if (editingItem) {
      await updateMut.mutateAsync({ uniId: editingItem.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
    setIsModalOpen(false);
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Universities</h1>
          </div>
          <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
            <Plus className="w-5 h-5 mr-2" />
            Add University
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
                  <th className="w-16">Icon</th>
                  <th>University Name</th>
                  <th>Country</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="text-center py-8">Loading...</td></tr>
                ) : universities?.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Building className="w-4 h-4" />
                      </div>
                    </td>
                    <td className="font-semibold text-foreground">{u.name}</td>
                    <td className="text-muted-foreground font-medium">{u.country || '-'}</td>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit University" : "New University"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>University Name *</Label>
            <Input name="name" required defaultValue={editingItem?.name || ""} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input name="country" defaultValue={editingItem?.country || ""} />
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
