import { useState } from "react";
import {
  useListApplications, useCreateApplication, useUpdateApplication,
  useListStudents, useListUniversities, useListUsers, useListStatuses, useListAgents,
  useGetDeptSettings
} from "@workspace/api-client-react";
import { Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Select, StatusBadge, Modal, Label, Textarea } from "@/components/ui-elements";
import { KanbanBoard } from "@/components/kanban-board";
import { BulkUploadButton } from "@/components/bulk-upload-button";
import { Search, Plus, FileEdit, LayoutGrid, List } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";

function StudentField({ defaultStudentId, defaultStudentName }: { defaultStudentId?: number | null; defaultStudentName?: string | null }) {
  const { data: students } = useListStudents();
  const [mode, setMode] = useState<"directory" | "manual">(defaultStudentId ? "directory" : (defaultStudentName ? "manual" : "directory"));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Student *</Label>
        <button type="button" onClick={() => setMode(m => m === "directory" ? "manual" : "directory")} className="text-xs text-primary hover:underline">
          {mode === "directory" ? "Not in directory? Type name" : "Select from directory"}
        </button>
      </div>
      {mode === "directory" ? (
        <>
          <Select name="student_id" defaultValue={defaultStudentId || ""}>
            <option value="">Select Student...</option>
            {students?.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
          <input type="hidden" name="student_name" value="" />
        </>
      ) : (
        <>
          <Input name="student_name" defaultValue={defaultStudentName || ""} placeholder="Type student full name..." required />
          <input type="hidden" name="student_id" value="" />
        </>
      )}
    </div>
  );
}

function UniversityField({ defaultUniversityId, defaultUniversityName }: { defaultUniversityId?: number | null; defaultUniversityName?: string | null }) {
  const { data: universities } = useListUniversities();
  const [mode, setMode] = useState<"directory" | "manual">(defaultUniversityName && !defaultUniversityId ? "manual" : "directory");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>University</Label>
        <button type="button" onClick={() => setMode(m => m === "directory" ? "manual" : "directory")} className="text-xs text-primary hover:underline">
          {mode === "directory" ? "Not in directory? Type name" : "Select from directory"}
        </button>
      </div>
      {mode === "directory" ? (
        <>
          <Select name="university_id" defaultValue={defaultUniversityId || ""}>
            <option value="">Select University...</option>
            {universities?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <input type="hidden" name="university_name" value="" />
        </>
      ) : (
        <>
          <Input name="university_name" defaultValue={defaultUniversityName || ""} placeholder="Type university name..." />
          <input type="hidden" name="university_id" value="" />
        </>
      )}
    </div>
  );
}

export default function GsApplications() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<number | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const p = new URLSearchParams(window.location.search).get("view");
    return p === "kanban" ? "kanban" : "table";
  });

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    window.history.replaceState(null, "", `${window.location.pathname}?view=${mode}`);
  };
  const [selectedFollowers, setSelectedFollowers] = useState<number[]>([]);

  const { data: applications, isLoading } = useListApplications({
    department: "gs",
    search: search || undefined,
    status: statusFilter || undefined,
    assigned_to_id: assigneeFilter ? Number(assigneeFilter) : undefined,
  });

  const { data: statuses } = useListStatuses({ department: "gs" });
  const { data: users } = useListUsers();
  const { data: agents } = useListAgents();
  const { data: gsSettings } = useGetDeptSettings("gs");

  const createMut = useCreateApplication();
  const updateMut = useUpdateApplication();

  const statusChoices = statuses?.map(s => s.name) || [];
  const statusColors: Record<string, { bg: string; text: string }> = {};
  statuses?.forEach(s => { statusColors[s.name] = { bg: s.bg_color, text: s.text_color }; });

  // Parse pinned tab statuses from dept settings
  const tabStatusesSetting = gsSettings?.find(s => s.key === "gs_tab_statuses")?.value || "";
  const pinnedTabStatuses = tabStatusesSetting ? tabStatusesSetting.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  const handleOpenEdit = (app: any) => {
    setEditingApp(app);
    setSelectedFollowers(app.follower_ids || []);
    setIsModalOpen(true);
  };
  const handleOpenCreate = () => {
    setEditingApp(null);
    setSelectedFollowers([]);
    setIsModalOpen(true);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const studentId = fd.get("student_id") ? Number(fd.get("student_id")) : undefined;
    const universityId = fd.get("university_id") ? Number(fd.get("university_id")) : undefined;
    const data: any = {
      department: "gs",
      app_id: fd.get("app_id") as string || null,
      student_id: studentId || null,
      student_name: fd.get("student_name") as string || null,
      university_id: universityId || null,
      university_name: fd.get("university_name") as string || null,
      agent_id: fd.get("agent_id") ? Number(fd.get("agent_id")) : null,
      assigned_to_id: fd.get("assigned_to_id") ? Number(fd.get("assigned_to_id")) : undefined,
      application_status: fd.get("application_status") as string,
      intake: fd.get("intake") as string,
      course: fd.get("course") as string,
      country: fd.get("country") as string,
      priority: fd.get("priority") as string,
      submitted_date: fd.get("submitted_date") as string || null,
      verification: fd.get("verification") as string,
      remarks: fd.get("remarks") as string,
      follower_ids: selectedFollowers,
    };
    if (editingApp) {
      await updateMut.mutateAsync({ appId: editingApp.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
    setIsModalOpen(false);
  };

  const displayName = (app: any) =>
    app.student?.full_name || app.student_name || "Unknown Student";
  const displayUni = (app: any) =>
    app.university?.name || app.university_name || "-";

  return (
    <Layout>
      <div className="h-full flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">GS Applications</h1>
            <p className="text-muted-foreground mt-1">Global Study applications — visa &amp; university tracking.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40">
              <button onClick={() => changeView("table")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors", viewMode === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <List className="w-4 h-4" />Table
              </button>
              <button onClick={() => changeView("kanban")} className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors", viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="w-4 h-4" />Board
              </button>
            </div>
            <BulkUploadButton department="gs" />
            <Button size="lg" onClick={handleOpenCreate}><Plus className="w-5 h-5 mr-2" />New GS App</Button>
          </div>
        </div>

        {/* Pinned status quick-filter tabs */}
        {pinnedTabStatuses.length > 0 && (
          <div className="flex gap-1 flex-wrap shrink-0 border-b border-border pb-0">
            <button
              onClick={() => setStatusFilter("")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors",
                statusFilter === "" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >All</button>
            {pinnedTabStatuses.map((s: string) => (
              <button
                key={s}
                onClick={() => setStatusFilter(prev => prev === s ? "" : s)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                  statusFilter === s ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {statusColors[s] && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColors[s].bg }} />
                )}
                {s}
              </button>
            ))}
          </div>
        )}

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
                  {statusChoices.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            )}
            <div className="min-w-[180px]">
              <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value as any)} className="bg-card">
                <option value="">All Assignees</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
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
                    <th className="w-8 text-center">#</th>
                    <th className="w-28">App ID</th>
                    <th>Student</th>
                    <th>University</th>
                    <th>Course</th>
                    <th>Intake</th>
                    <th>Submitted</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th>Ext. Agent</th>
                    <th>Assignee</th>
                    <th>Followers</th>
                    <th>Priority</th>
                    <th className="min-w-[220px]">Remarks</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {isLoading ? (
                    <tr><td colSpan={14} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : applications?.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-12 text-muted-foreground">No GS applications found.</td></tr>
                  ) : (
                    applications?.map(app => (
                      <tr key={app.id} className="group cursor-pointer" onClick={() => handleOpenEdit(app)}>
                        <td className="text-center text-muted-foreground text-xs">{app.id}</td>
                        <td>
                          {(app as any).app_id
                            ? <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">{(app as any).app_id}</span>
                            : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="font-semibold whitespace-nowrap">{displayName(app)}</td>
                        <td className="max-w-[160px]">
                          <div className="font-medium text-primary truncate">{displayUni(app)}</div>
                        </td>
                        <td className="max-w-[140px]">
                          <div className="text-sm truncate">{app.course || "-"}</div>
                        </td>
                        <td className="whitespace-nowrap">{app.intake || "-"}</td>
                        <td className="text-sm text-muted-foreground whitespace-nowrap">{app.submitted_date ? format(new Date(app.submitted_date), "MMM d, yy") : "-"}</td>
                        <td>
                          {app.verification ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${app.verification === "Verified" ? "bg-green-100 text-green-700" : app.verification === "Failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              {app.verification}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: statusColors[app.application_status]?.bg || "#f1f5f9", color: statusColors[app.application_status]?.text || "#475569" }}>
                            {app.application_status}
                          </span>
                        </td>
                        <td className="text-xs text-sky-600 whitespace-nowrap">
                          {app.agent?.name || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td>
                          {app.assigned_to ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-bold border border-border shrink-0">{app.assigned_to.full_name.charAt(0)}</div>
                              <span className="text-sm">{app.assigned_to.full_name.split(" ")[0]}</span>
                            </div>
                          ) : <span className="text-muted-foreground/40 text-xs">Unassigned</span>}
                        </td>
                        <td>
                          {app.follower_users && app.follower_users.length > 0 ? (
                            <div className="flex items-center -space-x-1.5" title={app.follower_users.map((u: any) => u.full_name).join(", ")}>
                              {app.follower_users.slice(0, 4).map((u: any) => (
                                <div key={u.id} className="w-6 h-6 rounded-full bg-violet-100 border-2 border-background flex items-center justify-center text-[10px] font-bold text-violet-700 shrink-0">
                                  {u.full_name.charAt(0)}
                                </div>
                              ))}
                              {app.follower_users.length > 4 && (
                                <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                  +{app.follower_users.length - 4}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase whitespace-nowrap ${app.priority === "high" ? "bg-red-100 text-red-700" : app.priority === "low" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"}`}>
                            {app.priority || "normal"}
                          </span>
                        </td>
                        <td className="min-w-[220px] max-w-[360px]">
                          {app.remarks
                            ? <span className="text-xs text-muted-foreground whitespace-normal break-words line-clamp-3 leading-relaxed" title={app.remarks}>{app.remarks}</span>
                            : <span className="opacity-30">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">Loading board...</div>
            ) : (
              <KanbanBoard
                applications={applications || []}
                statusChoices={statusChoices}
                statusColors={statusColors}
                onCardClick={handleOpenEdit}
              />
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingApp ? "Edit GS Application" : "New GS Application"} maxWidth="max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs font-bold text-blue-700 uppercase tracking-wide">App ID / Reference Code</Label>
              <Input name="app_id" defaultValue={(editingApp as any)?.app_id || ""} placeholder="e.g. GS-001, REF-2024-001" className="font-mono bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <StudentField key={editingApp?.id + "-s"} defaultStudentId={editingApp?.student_id} defaultStudentName={editingApp?.student_name} />
            <div className="space-y-2">
              <Label>Country</Label>
              <Input name="country" defaultValue={editingApp?.country || ""} placeholder="e.g. Australia" />
            </div>
            <UniversityField key={editingApp?.id + "-u"} defaultUniversityId={editingApp?.university_id} defaultUniversityName={editingApp?.university_name} />
            <div className="space-y-2">
              <Label>Course</Label>
              <Input name="course" defaultValue={editingApp?.course || ""} placeholder="e.g. Master of Data Science" />
            </div>
            <div className="space-y-2">
              <Label>Intake</Label>
              <Input name="intake" defaultValue={editingApp?.intake || ""} placeholder="e.g. Feb 2025" />
            </div>
            <div className="space-y-2">
              <Label>Submitted Date</Label>
              <Input type="date" name="submitted_date" defaultValue={editingApp?.submitted_date || ""} />
            </div>
            <div className="space-y-2">
              <Label>Verification</Label>
              <Select name="verification" defaultValue={editingApp?.verification || ""}>
                <option value="">Not set</option>
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="Failed">Failed</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Application Status</Label>
              <Select name="application_status" defaultValue={editingApp?.application_status || statusChoices[0] || "In Review"}>
                {statusChoices.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>External Agent (Sub-Agent / Partner)</Label>
              <Select name="agent_id" defaultValue={editingApp?.agent_id || ""}>
                <option value="">— None —</option>
                {agents?.map(a => <option key={a.id} value={a.id}>{a.name}{a.company_name ? ` (${a.company_name})` : ""}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Internal Assignee (Staff)</Label>
              <Select name="assigned_to_id" defaultValue={editingApp?.assigned_to_id || ""}>
                <option value="">Unassigned</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Followers <span className="text-muted-foreground font-normal text-xs">(also appear in their My Tasks)</span></Label>
              {selectedFollowers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedFollowers.map(uid => {
                    const u = users?.find(x => x.id === uid);
                    return u ? (
                      <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                        {u.full_name.split(" ")[0]}
                        <button type="button" onClick={() => setSelectedFollowers(f => f.filter(id => id !== uid))} className="ml-0.5 hover:text-violet-900">×</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              <div className="border border-border rounded-lg max-h-[130px] overflow-y-auto divide-y divide-border/50">
                {users?.map(u => (
                  <label key={u.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="rounded accent-violet-600"
                      checked={selectedFollowers.includes(u.id)}
                      onChange={e => setSelectedFollowers(f => e.target.checked ? [...f, u.id] : f.filter(id => id !== u.id))}
                    />
                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-border shrink-0">{u.full_name.charAt(0)}</div>
                    <span>{u.full_name}</span>
                    <span className="text-muted-foreground text-xs ml-auto">{u.role}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue={editingApp?.priority || "normal"}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
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
