import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, Button, Modal, Label, Select, Textarea, Input } from "@/components/ui-elements";
import { KanbanBoard } from "@/components/kanban-board";
import { useMyApplications, useListStatuses, useUpdateApplication, useGetMe } from "@workspace/api-client-react";
import { format } from "date-fns";
import { LayoutGrid, List, Edit2, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";
type DeptTab = "gs" | "offer";

export default function MyTasks() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [dept, setDept] = useState<DeptTab>("gs");
  const [search, setSearch] = useState("");
  const [editingApp, setEditingApp] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: currentUser } = useGetMe();

  const { data: gsApps, isLoading: gsLoading } = useMyApplications({ department: "gs" });
  const { data: offerApps, isLoading: offerLoading } = useMyApplications({ department: "offer" });
  const { data: gsStatuses } = useListStatuses({ department: "gs" });
  const { data: offerStatuses } = useListStatuses({ department: "offer" });
  const updateMut = useUpdateApplication();

  const rawApplications = dept === "gs" ? gsApps : offerApps;
  const isLoading = dept === "gs" ? gsLoading : offerLoading;
  const applications = search.trim()
    ? rawApplications?.filter(app => {
        const q = search.toLowerCase();
        const name = (app.student?.full_name || (app as any).student_name || "").toLowerCase();
        const appId = ((app as any).app_id || "").toLowerCase();
        return name.includes(q) || appId.includes(q);
      })
    : rawApplications;
  const rawStatuses = dept === "gs" ? gsStatuses : offerStatuses;
  const statusChoices = rawStatuses?.map(s => s.name) || [];
  const statusColors: Record<string, { bg: string; text: string }> = {};
  rawStatuses?.forEach(s => { statusColors[s.name] = { bg: s.bg_color, text: s.text_color }; });

  const openEdit = (app: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      application_status: fd.get("application_status") as string,
      remarks: fd.get("remarks") as string || null,
    };
    if (dept === "gs") {
      data.priority = fd.get("priority") as string;
    }
    await updateMut.mutateAsync({ appId: editingApp.id, data });
    queryClient.invalidateQueries({ queryKey: ["/api/applications/my"] });
    queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    setIsModalOpen(false);
  };

  const displayName = (app: any) => app.student?.full_name || app.student_name || "Unknown Student";
  const displayUni = (app: any) => app.university?.name || app.university_name || "-";

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">My Tasks</h1>
            <p className="text-muted-foreground mt-1">Applications assigned to you or that you follow.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40">
              <button
                onClick={() => setViewMode("table")}
                className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors", viewMode === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="w-4 h-4" />Table
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors", viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="w-4 h-4" />Board
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-1 border-b border-border shrink-0">
          {(["gs", "offer"] as DeptTab[]).map(d => (
            <button key={d} onClick={() => setDept(d)}
              className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px",
                dept === d ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {d === "gs" ? "GS Department" : "Offer Department"}
              {(d === "gs" ? gsApps : offerApps) && (
                <span className="ml-2 text-xs font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                  {(d === "gs" ? gsApps : offerApps)?.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by student name or App ID…"
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {viewMode === "table" ? (
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="table-container flex-1 h-full border-0 rounded-none">
              <table className="spreadsheet-table w-full h-full">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>Student Name</th>
                    <th>University &amp; Course</th>
                    <th>Intake</th>
                    {dept === "offer" && <th>Channel</th>}
                    <th>Status</th>
                    {dept === "gs" && <th>Priority</th>}
                    <th>Assigned Date</th>
                    <th className="text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {isLoading ? (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading your tasks...</td></tr>
                  ) : applications?.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No {dept === "gs" ? "GS" : "Offer"} tasks assigned to you.</td></tr>
                  ) : (
                    applications?.map((app) => (
                      <tr key={app.id} className="hover:bg-muted/30 group cursor-pointer" onClick={() => openEdit(app)}>
                        <td className="text-center text-muted-foreground text-xs">{app.id}</td>
                        <td className="font-semibold">
                          <div className="flex items-center gap-2 flex-wrap">
                            {displayName(app)}
                            {currentUser && app.assigned_to_id !== currentUser.id && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 shrink-0">Following</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-primary">{displayUni(app)}</div>
                          <div className="text-xs text-muted-foreground">{(app as any).course || "-"}</div>
                        </td>
                        <td>{(app as any).intake || "-"}</td>
                        {dept === "offer" && (
                          <td>
                            {(app as any).channel ? (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">{(app as any).channel}</span>
                            ) : "-"}
                          </td>
                        )}
                        <td>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: statusColors[app.application_status]?.bg || "#f1f5f9", color: statusColors[app.application_status]?.text || "#475569" }}>
                            {app.application_status}
                          </span>
                        </td>
                        {dept === "gs" && (
                          <td>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${(app as any).priority === "high" ? "bg-red-100 text-red-700" : (app as any).priority === "low" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"}`}>
                              {(app as any).priority || "normal"}
                            </span>
                          </td>
                        )}
                        <td className="text-muted-foreground text-sm">
                          {app.assigned_date ? format(new Date(app.assigned_date), "MMM d, yyyy") : "-"}
                        </td>
                        <td className="text-right">
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100"
                            onClick={(e) => openEdit(app, e)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1" />Update
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
                statusChoices={statusChoices}
                statusColors={statusColors}
                queryInvalidateKeys={["/api/applications/my"]}
                onCardClick={openEdit}
              />
            )}
          </div>
        )}
      </div>

      {/* Quick Update Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Update Task">
        {editingApp && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/40 border">
              <div className="font-semibold">{displayName(editingApp)}</div>
              <div className="text-sm text-muted-foreground">{displayUni(editingApp)} · {(editingApp as any).course || "No course"}</div>
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select name="application_status" defaultValue={editingApp.application_status} required>
                {statusChoices.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            {dept === "gs" && (
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select name="priority" defaultValue={(editingApp as any).priority || "normal"}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Remarks / Notes</Label>
              <Textarea name="remarks" defaultValue={(editingApp as any).remarks || ""} placeholder="Add a note about this update..." rows={3} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={updateMut.isPending}>Save Update</Button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
}
