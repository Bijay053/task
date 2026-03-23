import { useState } from "react";
import { usePermissions } from "@/lib/permission-context";
import { useQuery } from "@tanstack/react-query";
import {
  useListApplications, useCreateApplication, useUpdateApplication, useDeleteApplication,
  useListStudents, useListUniversities, useListUsers, useListStatuses, useListAgents,
  useGetDeptSettings
} from "@workspace/api-client-react";
import { Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Select, StatusBadge, Modal, Label, Textarea } from "@/components/ui-elements";
import { ApplicationHistory } from "@/components/application-history";
import { KanbanBoard } from "@/components/kanban-board";
import { TableScrollWrapper } from "@/components/table-scroll-wrapper";
import { BulkUploadButton } from "@/components/bulk-upload-button";
import { Search, Plus, FileEdit, LayoutGrid, List, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "table" | "kanban";

function StudentField({ defaultStudentId, defaultStudentName, onSelect }: { defaultStudentId?: number | null; defaultStudentName?: string | null; onSelect?: (id: number | null) => void }) {
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
          <Select name="student_id" defaultValue={defaultStudentId || ""} onChange={e => onSelect?.(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Select Student...</option>
            {students?.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </Select>
          <input type="hidden" name="student_name" value="" />
        </>
      ) : (
        <>
          <Input name="student_name" defaultValue={defaultStudentName || ""} placeholder="Type student full name..." required onChange={() => onSelect?.(null)} />
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

export default function GsApplications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEdit, canDelete, canViewAllUsers, canViewMappedUsers } = usePermissions();
  const { data: myTeamUsers } = useQuery<any[]>({
    queryKey: ["/api/users/my-team"],
    queryFn: async () => {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/users/my-team", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canViewMappedUsers("gs"),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<number | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<any>(null);
  const [formError, setFormError] = useState("");
  const [agentInput, setAgentInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const p = new URLSearchParams(window.location.search).get("view");
    return p === "kanban" ? "kanban" : "table";
  });

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    window.history.replaceState(null, "", `${window.location.pathname}?view=${mode}`);
  };
  const [selectedFollowers, setSelectedFollowers] = useState<number[]>([]);
  const [followerSearch, setFollowerSearch] = useState("");

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

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [offerAutofillApps, setOfferAutofillApps] = useState<any[]>([]);
  const [autofill, setAutofill] = useState<{ universityId?: number; universityName?: string; course?: string; intake?: string } | null>(null);
  const [autofillKey, setAutofillKey] = useState(0);

  const handleStudentSelect = async (studentId: number | null) => {
    setAutofill(null);
    setOfferAutofillApps([]);
    if (!studentId) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`/api/applications?department=offer&student_id=${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOfferAutofillApps(data);
      }
    } catch {}
  };

  const applyAutofill = (offerApp: any) => {
    setAutofill({
      universityId: offerApp.university_id,
      universityName: offerApp.university_name,
      course: offerApp.course || "",
      intake: offerApp.intake || "",
    });
    setAutofillKey(k => k + 1);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (applications && selectedIds.size === applications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications?.map((a: any) => a.id) || []));
    }
  };
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/applications/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ app_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast({ title: `${count} application(s) deleted` });
    } catch {
      toast({ variant: "destructive", title: "Bulk delete failed" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const createMut = useCreateApplication();
  const updateMut = useUpdateApplication();
  const deleteMut = useDeleteApplication();

  const statusChoices = statuses?.map(s => s.name) || [];
  const statusColors: Record<string, { bg: string; text: string }> = {};
  statuses?.forEach(s => { statusColors[s.name] = { bg: s.bg_color, text: s.text_color }; });

  // Parse pinned tab statuses from dept settings
  const tabStatusesSetting = gsSettings?.find(s => s.key === "gs_tab_statuses")?.value || "";
  const pinnedTabStatuses = tabStatusesSetting ? tabStatusesSetting.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  const handleOpenEdit = (app: any) => {
    setEditingApp(app);
    setSelectedFollowers(app.follower_ids || []);
    setDeleteConfirm(false);
    setFormError("");
    setOfferAutofillApps([]);
    setAutofill(null);
    setAgentInput(app.agent?.name || app.agent_name || "");
    setIsModalOpen(true);
  };
  const handleOpenCreate = () => {
    setEditingApp(null);
    setSelectedFollowers([]);
    setFollowerSearch("");
    setDeleteConfirm(false);
    setFormError("");
    setOfferAutofillApps([]);
    setAutofill(null);
    setAgentInput("");
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
    const agentText = agentInput.trim();
    const matchedAgent = agents?.find(a => a.name === agentText || `${a.name}${a.company_name ? ` (${a.company_name})` : ""}` === agentText);
    const data: any = {
      department: "gs",
      app_id: fd.get("app_id") as string || null,
      student_id: studentId || null,
      student_name: fd.get("student_name") as string || null,
      university_id: universityId || null,
      university_name: fd.get("university_name") as string || null,
      agent_id: matchedAgent ? matchedAgent.id : null,
      agent_name: matchedAgent ? null : (agentText || null),
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
      const detail = (err?.data as any)?.detail || err?.message || "Something went wrong.";
      setFormError(detail);
    }
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
            {canEdit("gs") && <Button size="lg" onClick={handleOpenCreate}><Plus className="w-5 h-5 mr-2" />New GS App</Button>}
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
            {(canViewAllUsers("gs") || canViewMappedUsers("gs")) && (
              <div className="min-w-[180px]">
                <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value as any)} className="bg-card">
                  <option value="">{canViewAllUsers("gs") ? "All Assignees" : "My Team"}</option>
                  {(canViewAllUsers("gs") ? users : myTeamUsers)?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </Select>
              </div>
            )}
          </div>
        </Card>

        {canDelete("gs") && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/10 border border-destructive/30 rounded-lg shrink-0">
            <span className="text-sm font-medium text-destructive">{selectedIds.size} application{selectedIds.size > 1 ? "s" : ""} selected</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>
            <div className="flex-1" />
            {bulkDeleteConfirm ? (
              <>
                <span className="text-sm font-medium text-destructive">Delete {selectedIds.size} application{selectedIds.size > 1 ? "s" : ""}?</span>
                <Button type="button" variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                  {bulkDeleting ? "Deleting…" : "Yes, Delete"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <Button type="button" variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-1.5" />Delete Selected
              </Button>
            )}
          </div>
        )}

        {viewMode === "table" ? (
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TableScrollWrapper>
              <table className="spreadsheet-table w-full h-full">
                <thead>
                  <tr>
                    {canDelete("gs") && (
                      <th className="w-10 text-center">
                        <input
                          type="checkbox"
                          checked={!!applications && applications.length > 0 && selectedIds.size === applications.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded cursor-pointer accent-destructive"
                        />
                      </th>
                    )}
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
                    <tr><td colSpan={canDelete("gs") ? 15 : 14} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : applications?.length === 0 ? (
                    <tr><td colSpan={canDelete("gs") ? 15 : 14} className="text-center py-12 text-muted-foreground">No GS applications found.</td></tr>
                  ) : (
                    applications?.map(app => (
                      <tr key={app.id} className={cn("group", canEdit("gs") ? "cursor-pointer" : "cursor-default", selectedIds.has(app.id) ? "bg-destructive/5" : "")} onClick={() => canEdit("gs") && handleOpenEdit(app)}>
                        {canDelete("gs") && (
                          <td className="text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(app.id)}
                              onChange={() => toggleSelect(app.id)}
                              className="w-4 h-4 rounded cursor-pointer accent-destructive"
                            />
                          </td>
                        )}
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
                        <td className="whitespace-nowrap">{app.intake ? app.intake.replace(/\s00:00:00$/, "") : "-"}</td>
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
                          {app.agent?.name || app.agent_name || <span className="text-muted-foreground/40">—</span>}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingApp ? "Edit GS Application" : "New GS Application"} maxWidth="max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs font-bold text-blue-700 uppercase tracking-wide">App ID / Reference Code</Label>
              <Input name="app_id" required defaultValue={(editingApp as any)?.app_id || ""} placeholder="e.g. GS-001, REF-2024-001" className="font-mono bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <StudentField key={editingApp?.id + "-s"} defaultStudentId={editingApp?.student_id} defaultStudentName={editingApp?.student_name} onSelect={!editingApp ? handleStudentSelect : undefined} />
            <div className="space-y-2">
              <Label>Country</Label>
              <Input name="country" defaultValue={editingApp?.country || ""} placeholder="e.g. Australia" />
            </div>

            {!editingApp && offerAutofillApps.length > 0 && (
              <div className="md:col-span-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-xs font-semibold text-green-800 mb-2">
                  ✦ Offer application(s) found for this student — click to auto-fill university, course &amp; intake:
                </p>
                <div className="flex flex-col gap-1.5">
                  {offerAutofillApps.map((o: any) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => applyAutofill(o)}
                      className="text-left text-xs rounded-lg border border-green-300 bg-white hover:bg-green-100 px-3 py-2 transition-colors"
                    >
                      <span className="font-semibold text-green-900">{o.university_name || "Unknown University"}</span>
                      {o.course && <span className="text-green-700"> · {o.course}</span>}
                      {o.intake && <span className="text-green-600"> · {o.intake}</span>}
                      {(o as any).app_id && <span className="ml-2 font-mono text-green-500 text-[10px]">{(o as any).app_id}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <UniversityField key={`${editingApp?.id ?? "new"}-u-${autofillKey}`} defaultUniversityId={autofill?.universityId ?? editingApp?.university_id} defaultUniversityName={autofill?.universityName ?? editingApp?.university_name} />
            <div className="space-y-2">
              <Label>Course</Label>
              <Input key={`${editingApp?.id ?? "new"}-course-${autofillKey}`} name="course" defaultValue={autofill?.course ?? editingApp?.course ?? ""} placeholder="e.g. Master of Data Science" />
            </div>
            <div className="space-y-2">
              <Label>Intake</Label>
              <Input key={`${editingApp?.id ?? "new"}-intake-${autofillKey}`} name="intake" defaultValue={autofill?.intake ?? editingApp?.intake ?? ""} placeholder="e.g. Feb 2025" />
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
              <Select name="application_status" defaultValue={editingApp?.application_status || ""}>
                {!editingApp && <option value="">— Select Status —</option>}
                {statusChoices.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>External Agent (Sub-Agent / Partner)</Label>
              <div className="relative">
                <input
                  list="gs-agents-datalist"
                  value={agentInput}
                  onChange={e => setAgentInput(e.target.value)}
                  placeholder="Type or select agent…"
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {agentInput && (
                  <button type="button" onClick={() => setAgentInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">✕</button>
                )}
              </div>
              <datalist id="gs-agents-datalist">
                {agents?.map(a => (
                  <option key={a.id} value={`${a.name}${a.company_name ? ` (${a.company_name})` : ""}`} />
                ))}
              </datalist>
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
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search users to add..."
                  className="pl-8 h-8 text-sm"
                  value={followerSearch}
                  onChange={e => setFollowerSearch(e.target.value)}
                />
              </div>
              {followerSearch.trim() && (
                <div className="border border-border rounded-lg max-h-[130px] overflow-y-auto divide-y divide-border/50">
                  {(users?.filter(u =>
                    u.full_name.toLowerCase().includes(followerSearch.toLowerCase()) &&
                    !selectedFollowers.includes(u.id)
                  ) ?? []).length === 0 ? (
                    <div className="px-3 py-3 text-xs text-muted-foreground italic text-center">No users found</div>
                  ) : (
                    users?.filter(u =>
                      u.full_name.toLowerCase().includes(followerSearch.toLowerCase()) &&
                      !selectedFollowers.includes(u.id)
                    ).map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          className="rounded accent-violet-600"
                          checked={false}
                          onChange={() => { setSelectedFollowers(f => [...f, u.id]); setFollowerSearch(""); }}
                        />
                        <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold border border-border shrink-0">{u.full_name.charAt(0)}</div>
                        <span>{u.full_name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{u.role}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
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
          {formError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
              <span>{formError}</span>
            </div>
          )}
          {editingApp && (
            <ApplicationHistory appId={editingApp.id} users={users} />
          )}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {editingApp && canDelete("gs") && (
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
