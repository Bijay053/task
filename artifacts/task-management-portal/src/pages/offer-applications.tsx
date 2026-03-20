import { useState } from "react";
import { useListApplications, useCreateApplication, useUpdateApplication, useListStudents, useListUniversities, useListUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Select, StatusBadge, Modal, Label, Textarea } from "@/components/ui-elements";
import { KanbanBoard } from "@/components/kanban-board";
import { Search, Plus, FileEdit, LayoutGrid, List } from "lucide-react";
import { OFFER_STATUS_CHOICES, OFFER_STATUS_COLORS, OFFER_CHANNEL_CHOICES } from "@/lib/utils";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";

export default function OfferApplications() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<number | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const { data: applications, isLoading } = useListApplications({
    department: "offer",
    search: search || undefined,
    status: statusFilter || undefined,
    assigned_to_id: assigneeFilter ? Number(assigneeFilter) : undefined,
  });

  const { data: students } = useListStudents();
  const { data: universities } = useListUniversities();
  const { data: users } = useListUsers();

  const createMut = useCreateApplication();
  const updateMut = useUpdateApplication();

  const handleOpenEdit = (app: any) => { setEditingApp(app); setIsModalOpen(true); };
  const handleOpenCreate = () => { setEditingApp(null); setIsModalOpen(true); };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      department: "offer",
      student_id: Number(fd.get("student_id")),
      university_id: fd.get("university_id") ? Number(fd.get("university_id")) : undefined,
      assigned_to_id: fd.get("assigned_to_id") ? Number(fd.get("assigned_to_id")) : undefined,
      application_status: fd.get("application_status") as string,
      intake: fd.get("intake") as string,
      course: fd.get("course") as string,
      channel: fd.get("channel") as string,
      offer_applied_date: fd.get("offer_applied_date") as string || undefined,
      offer_received_date: fd.get("offer_received_date") as string || undefined,
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
      <div className="h-full flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Offer Applications</h1>
            <p className="text-muted-foreground mt-1">Track university offer requests and received offers.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40">
              <button onClick={() => setViewMode("table")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors", viewMode === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <List className="w-4 h-4" />Table
              </button>
              <button onClick={() => setViewMode("kanban")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors", viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="w-4 h-4" />Board
              </button>
            </div>
            <Button size="lg" onClick={handleOpenCreate}><Plus className="w-5 h-5 mr-2" />New Offer App</Button>
          </div>
        </div>

        <Card className="p-4 flex flex-col sm:flex-row gap-4 bg-muted/30 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input placeholder="Search by student name..." className="pl-10 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-4">
            {viewMode === "table" && (
              <div className="min-w-[180px]">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-card">
                  <option value="">All Statuses</option>
                  {OFFER_STATUS_CHOICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            )}
            <div className="min-w-[180px]">
              <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value as any)} className="bg-card">
                <option value="">All Agents</option>
                {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </div>
          </div>
        </Card>

        {viewMode === "table" ? (
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="table-container flex-1 h-full border-0 rounded-none">
              <table className="spreadsheet-table w-full h-full">
                <thead>
                  <tr>
                    <th className="w-10 text-center">#</th>
                    <th>Student</th>
                    <th>University / Course</th>
                    <th>Intake</th>
                    <th>Channel</th>
                    <th>Applied Date</th>
                    <th>Status</th>
                    <th>Received Date</th>
                    <th>Agent</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {isLoading ? (
                    <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : applications?.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No offer applications found.</td></tr>
                  ) : (
                    applications?.map((app) => (
                      <tr key={app.id} className="group cursor-pointer" onClick={() => handleOpenEdit(app)}>
                        <td className="text-center text-muted-foreground text-xs">{app.id}</td>
                        <td className="font-semibold">{app.student?.full_name}</td>
                        <td>
                          <div className="font-medium text-primary">{app.university?.name || "-"}</div>
                          <div className="text-xs text-muted-foreground">{app.course || "-"}</div>
                        </td>
                        <td>{app.intake || "-"}</td>
                        <td>
                          {app.channel ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">{app.channel}</span>
                          ) : "-"}
                        </td>
                        <td className="text-sm text-muted-foreground">{app.offer_applied_date ? format(new Date(app.offer_applied_date), "MMM d, yyyy") : "-"}</td>
                        <td><StatusBadge status={app.application_status} department="offer" /></td>
                        <td className="text-sm text-muted-foreground">{app.offer_received_date ? format(new Date(app.offer_received_date), "MMM d, yyyy") : "-"}</td>
                        <td>
                          {app.assigned_to ? (
                            <div className="flex items-center">
                              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold mr-2 border border-border">
                                {app.assigned_to.full_name.charAt(0)}
                              </div>
                              <span className="text-sm">{app.assigned_to.full_name}</span>
                            </div>
                          ) : <span className="text-muted-foreground text-sm italic">Unassigned</span>}
                        </td>
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
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Loading board...</div>
            ) : (
              <KanbanBoard
                applications={applications || []}
                statusChoices={OFFER_STATUS_CHOICES}
                statusColors={OFFER_STATUS_COLORS}
                queryInvalidateKeys={["/api/applications?department=offer"]}
              />
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingApp ? "Edit Offer Application" : "New Offer Application"} maxWidth="max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select name="student_id" defaultValue={editingApp?.student_id || ""} required disabled={!!editingApp}>
                <option value="">Select Student...</option>
                {students?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>University</Label>
              <Select name="university_id" defaultValue={editingApp?.university_id || ""}>
                <option value="">Select University...</option>
                {universities?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Input name="course" defaultValue={editingApp?.course || ""} placeholder="e.g. Bachelor of Science" />
            </div>
            <div className="space-y-2">
              <Label>Intake</Label>
              <Input name="intake" defaultValue={editingApp?.intake || ""} placeholder="e.g. Feb 2025" />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select name="channel" defaultValue={editingApp?.channel || ""}>
                <option value="">Select Channel...</option>
                {OFFER_CHANNEL_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="application_status" defaultValue={editingApp?.application_status || "On Hold"}>
                {OFFER_STATUS_CHOICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Offer Applied Date</Label>
              <Input type="date" name="offer_applied_date" defaultValue={editingApp?.offer_applied_date || ""} />
            </div>
            <div className="space-y-2">
              <Label>Offer Received Date</Label>
              <Input type="date" name="offer_received_date" defaultValue={editingApp?.offer_received_date || ""} />
            </div>
            <div className="space-y-2">
              <Label>Agent (Assignee)</Label>
              <Select name="assigned_to_id" defaultValue={editingApp?.assigned_to_id || ""}>
                <option value="">Unassigned</option>
                {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea name="remarks" defaultValue={editingApp?.remarks || ""} placeholder="Internal notes..." />
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
