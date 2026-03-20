import { useState } from "react";
import { useListApplications, useCreateApplication, useUpdateApplication, useListStudents, useListUniversities, useListUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Select, StatusBadge, Modal, Label, Textarea } from "@/components/ui-elements";
import { Search, Plus, Filter, FileEdit } from "lucide-react";
import { STATUS_CHOICES } from "@/lib/utils";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Applications() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<number | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);

  const { data: applications, isLoading } = useListApplications({
    search: search || undefined,
    status: statusFilter || undefined,
    assigned_to_id: assigneeFilter ? Number(assigneeFilter) : undefined
  });

  const { data: students } = useListStudents();
  const { data: universities } = useListUniversities();
  const { data: users } = useListUsers();

  const createMut = useCreateApplication();
  const updateMut = useUpdateApplication();

  const handleOpenEdit = (app: any) => {
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingApp(null);
    setIsModalOpen(true);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      student_id: Number(fd.get("student_id")),
      university_id: fd.get("university_id") ? Number(fd.get("university_id")) : undefined,
      assigned_to_id: fd.get("assigned_to_id") ? Number(fd.get("assigned_to_id")) : undefined,
      application_status: fd.get("application_status") as string,
      intake: fd.get("intake") as string,
      course: fd.get("course") as string,
      country: fd.get("country") as string,
      priority: fd.get("priority") as string,
      source: fd.get("source") as string,
      remarks: fd.get("remarks") as string,
    };

    if (editingApp) {
      await updateMut.mutateAsync({ appId: editingApp.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    setIsModalOpen(false);
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Applications Master List</h1>
            <p className="text-muted-foreground mt-1">Manage and track all student applications globally.</p>
          </div>
          <Button size="lg" onClick={handleOpenCreate}>
            <Plus className="w-5 h-5 mr-2" />
            New Application
          </Button>
        </div>

        <Card className="p-4 flex flex-col sm:flex-row gap-4 bg-muted/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              placeholder="Search by student name..." 
              className="pl-10 bg-card"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <div className="relative min-w-[200px]">
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-card">
                <option value="">All Statuses</option>
                {STATUS_CHOICES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="relative min-w-[200px]">
              <Select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value as any)} className="bg-card">
                <option value="">All Assignees</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </div>
          </div>
        </Card>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="table-container flex-1 h-full border-0 rounded-none">
            <table className="spreadsheet-table w-full h-full">
              <thead>
                <tr>
                  <th className="w-12 text-center">ID</th>
                  <th>Student Name</th>
                  <th>University & Course</th>
                  <th>Intake</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Last Updated</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="align-top">
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading applications...</td></tr>
                ) : applications?.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No applications found matching criteria.</td></tr>
                ) : (
                  applications?.map(app => (
                    <tr key={app.id} className="group cursor-pointer" onClick={() => handleOpenEdit(app)}>
                      <td className="text-center text-muted-foreground text-xs">{app.id}</td>
                      <td className="font-semibold">{app.student?.full_name}</td>
                      <td>
                        <div className="font-medium text-primary">{app.university?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{app.course || '-'}</div>
                      </td>
                      <td>{app.intake || '-'}</td>
                      <td><StatusBadge status={app.application_status} /></td>
                      <td>
                        {app.assigned_to ? (
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold mr-2 border border-border">
                              {app.assigned_to.full_name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium">{app.assigned_to.full_name}</span>
                          </div>
                        ) : <span className="text-muted-foreground text-sm italic">Unassigned</span>}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${app.priority === 'high' ? 'bg-red-100 text-red-700' : app.priority === 'low' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                          {app.priority || 'normal'}
                        </span>
                      </td>
                      <td className="text-muted-foreground text-sm">{format(new Date(app.updated_at), 'MMM d, yyyy')}</td>
                      <td>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleOpenEdit(app); }}>
                          <FileEdit className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingApp ? "Edit Application" : "New Application"} maxWidth="max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select name="student_id" defaultValue={editingApp?.student_id || ""} required disabled={!!editingApp}>
                <option value="">Select Student...</option>
                {students?.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>University</Label>
              <Select name="university_id" defaultValue={editingApp?.university_id || ""}>
                <option value="">Select University...</option>
                {universities?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Input name="course" defaultValue={editingApp?.course || ""} placeholder="e.g. Master of Data Science" />
            </div>
            <div className="space-y-2">
              <Label>Intake</Label>
              <Input name="intake" defaultValue={editingApp?.intake || ""} placeholder="e.g. Feb 2025" />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input name="country" defaultValue={editingApp?.country || ""} placeholder="e.g. Australia" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue={editingApp?.priority || "normal"}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="application_status" defaultValue={editingApp?.application_status || "In Review"}>
                {STATUS_CHOICES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select name="assigned_to_id" defaultValue={editingApp?.assigned_to_id || ""}>
                <option value="">Unassigned</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Remarks / Notes</Label>
            <Textarea name="remarks" defaultValue={editingApp?.remarks || ""} placeholder="Add any internal notes here..." />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMut.isPending || updateMut.isPending}>Save Application</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
