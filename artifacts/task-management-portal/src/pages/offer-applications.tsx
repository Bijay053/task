import { useState } from "react";
import { usePermissions } from "@/lib/permission-context";
import {
  useListApplications, useCreateApplication, useUpdateApplication, useDeleteApplication,
  useListStudents, useListUniversities, useListUsers, useListStatuses, useListAgents
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Select, Modal, Label, Textarea } from "@/components/ui-elements";
import { KanbanBoard } from "@/components/kanban-board";
import { TableScrollWrapper } from "@/components/table-scroll-wrapper";
import { BulkUploadButton } from "@/components/bulk-upload-button";
import { Search, Plus, FileEdit, LayoutGrid, List, Users, Trash2 } from "lucide-react";
import { OFFER_CHANNEL_CHOICES } from "@/lib/utils";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "table" | "kanban";

function StudentField({ defaultStudentId, defaultStudentName }: { defaultStudentId?: number | null; defaultStudentName?: string | null }) {
  const { data: students } = useListStudents();
  const [mode, setMode] = useState<"directory" | "manual">(defaultStudentId ? "directory" : "manual");
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
  const [mode, setMode] = useState<"directory" | "manual">(defaultUniversityId ? "directory" : "manual");
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

export default function OfferApplications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<number | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [formError, setFormError] = useState("");
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
    department: "offer",
    search: search || undefined,
    status: statusFilter || undefined,
    assigned_to_id: assigneeFilter ? Number(assigneeFilter) : undefined,
  });

  const { data: statuses } = useListStatuses({ department: "offer" });
  const { data: users } = useListUsers();
  const { data: agents } = useListAgents();

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const createMut = useCreateApplication();
  const updateMut = useUpdateApplication();
  const deleteMut = useDeleteApplication();

  const statusChoices = statuses?.map(s => s.name) || [];
  const statusColors: Record<string, { bg: string; text: string }> = {};
  statuses?.forEach(s => { statusColors[s.name] = { bg: s.bg_color, text: s.text_color }; });

  const handleOpenEdit = (app: any) => {
    setEditingApp(app);
    setSelectedFollowers(app.follower_ids || []);
    setDeleteConfirm(false);
    setFormError("");
    setIsModalOpen(true);
  };
  const handleOpenCreate = () => {
    setEditingApp(null);
    setSelectedFollowers([]);
    setDeleteConfirm(false);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!editingApp) return;
    try {
      await deleteMut.mutateAsync({ appId: editingApp.id });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsModalOpen(false);
      setDeleteConfirm(false);
      toast({ title: "Application deleted" });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Could not delete.";
      toast({ variant: "destructive", title: "Delete failed", description: detail });
      setDeleteConfirm(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const studentId = fd.get("student_id") ? Number(fd.get("student_id")) : undefined;
    const universityId = fd.get("university_id") ? Number(fd.get("university_id")) : undefined;
    const data: any = {
      department: "offer",
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
      channel: fd.get("channel") as string,
      offer_applied_date: fd.get("offer_applied_date") as string || null,
      offer_received_date: fd.get("offer_received_date") as string || null,
      remarks: fd.get("remarks") as string,
      follower_ids: selectedFollowers,
    };
    setFormError("");
    try {
      if (editingApp) {
        await updateMut.mutateAsync({ appId: editingApp.id, data });
      } else {
        await createMut.mutateAsync({ data });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
      setIsModalOpen(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Something went wrong.";
      setFormError(detail);
    }
  };

  const displayName = (app: any) => app.student?.full_name || app.student_name || "Unknown Student";
  const displayUni = (app: any) => app.university?.name || app.university_name || "-";

  return (
    <Layout>
      <div className="h-full flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Offer Applications</h1>
            <p className="text-muted-foreground mt-1">Track university offer requests and received offers.</p>
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
            <BulkUploadButton department="offer" />
            {canEdit("offer") && <Button size="lg" onClick={handleOpenCreate}><Plus className="w-5 h-5 mr-2" />New Offer App</Button>}
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
                  {statusChoices.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            )}
            <div className="min-w-[180px]">
              <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value as any)} className="bg-card">
                <option value="">All Agents</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </div>
          </div>
        </Card>

        {viewMode === "table" ? (
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TableScrollWrapper>
              <table className="spreadsheet-table w-full h-full">
                <thead>
                  <tr>
                    <th className="w-8 text-center">#</th>
                    <th className="w-28">App ID</th>
                    <th>Student</th>
                    <th>University</th>
                    <th>Course</th>
                    <th>Intake</th>
                    <th>Channel</th>
                    <th>Applied Date</th>
                    <th>Status</th>
                    <th>Received Date</th>
                    <th>Ext. Agent</th>
                    <th>Assignee</th>
                    <th>Followers</th>
                    <th>Priority</th>
                    <th className="min-w-[220px]">Remarks</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {isLoading ? (
                    <tr><td colSpan={15} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : applications?.length === 0 ? (
                    <tr><td colSpan={15} className="text-center py-12 text-muted-foreground">No offer applications found.</td></tr>
                  ) : (
                    applications?.map(app => (
                      <tr key={app.id} className={`group ${canEdit("offer") ? "cursor-pointer" : "cursor-default"}`} onClick={() => canEdit("offer") && handleOpenEdit(app)}>
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
                        <td className="max-w-[130px]">
                          <div className="text-sm truncate">{app.course || "-"}</div>
                        </td>
                        <td className="whitespace-nowrap">{app.intake ? app.intake.replace(/\s00:00:00$/, "") : "-"}</td>
                        <td>
                          {app.channel ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 whitespace-nowrap">{app.channel}</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="text-sm text-muted-foreground whitespace-nowrap">{app.offer_applied_date ? format(new Date(app.offer_applied_date), "MMM d, yy") : "-"}</td>
                        <td>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: statusColors[app.application_status]?.bg || "#f1f5f9", color: statusColors[app.application_status]?.text || "#475569" }}>
                            {app.application_status}
                          </span>
                        </td>
                        <td className="text-sm text-muted-foreground whitespace-nowrap">{app.offer_received_date ? format(new Date(app.offer_received_date), "MMM d, yy") : "-"}</td>
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
            </TableScrollWrapper>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingApp ? "Edit Offer Application" : "New Offer Application"} maxWidth="max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs font-bold text-blue-700 uppercase tracking-wide">App ID / Reference Code</Label>
              <Input name="app_id" required defaultValue={(editingApp as any)?.app_id || ""} placeholder="e.g. OFF-001, REF-2024-001" className="font-mono bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <StudentField key={editingApp?.id + "-s"} defaultStudentId={editingApp?.student_id} defaultStudentName={editingApp?.student_name} />
            <UniversityField key={editingApp?.id + "-u"} defaultUniversityId={editingApp?.university_id} defaultUniversityName={editingApp?.university_name} />
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
                {OFFER_CHANNEL_CHOICES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select name="application_status" defaultValue={editingApp?.application_status || ""}>
                {!editingApp && <option value="">— Select Status —</option>}
                {statusChoices.map(s => <option key={s} value={s}>{s}</option>)}
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
          </div>
          <div className="space-y-2">
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
            <Label>Remarks</Label>
            <Textarea name="remarks" defaultValue={editingApp?.remarks || ""} placeholder="Internal notes..." />
          </div>
          {formError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
              <span>{formError}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {editingApp && canDelete("offer") && (
                deleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive font-medium">Delete this application?</span>
                    <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMut.isPending}>
                      {deleteMut.isPending ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(true)}>
                    <Trash2 className="w-4 h-4 mr-1.5" />Delete
                  </Button>
                )
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={createMut.isPending || updateMut.isPending}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Saving…</>
                ) : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
