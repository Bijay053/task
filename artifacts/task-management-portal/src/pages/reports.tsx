import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { useListUsers } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/lib/permission-context";
import {
  BarChart3, ShieldAlert, Users, FileText, TrendingUp, Award,
  Clock, AlertTriangle, CheckCircle2, Timer, Layers, CalendarRange, X
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin:       { label: "Admin", cls: "bg-violet-100 text-violet-700" },
  manager:     { label: "Manager", cls: "bg-blue-100 text-blue-700" },
  team_leader: { label: "Team Leader", cls: "bg-emerald-100 text-emerald-700" },
  agent:       { label: "Agent", cls: "bg-slate-100 text-slate-700" },
};

type ReportTab = "workload" | "timing" | "stages";

function fmtDays(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)}d`;
}

function DaysBar({ days, max, color = "bg-primary" }: { days: number | null; max: number; color?: string }) {
  if (days == null) return <span className="text-muted-foreground/40 text-xs">No data</span>;
  const pct = Math.min(100, Math.round((days / Math.max(1, max)) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden min-w-[80px]">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">{fmtDays(days)}</span>
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

async function fetchReport(path: string, params: Record<string, string | undefined>) {
  const url = new URL(`/api${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const token = localStorage.getItem("access_token");
  const res = await fetch(url.toString(), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json();
}

export default function Reports() {
  const { user } = useAuth();
  const { isCustomRole, canView } = usePermissions();
  const isManager = user?.role === "admin" || user?.role === "manager" || (isCustomRole && canView("reports"));
  const [deptFilter, setDeptFilter] = useState<"" | "gs" | "offer">("");
  const [reportTab, setReportTab] = useState<ReportTab>(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    return (["workload", "timing", "stages"] as ReportTab[]).includes(p as ReportTab) ? (p as ReportTab) : "workload";
  });

  const changeReportTab = (tab: ReportTab) => {
    setReportTab(tab);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${tab}`);
  };
  const [timingDept, setTimingDept] = useState<"gs" | "offer">("gs");
  const [stagesDept, setStagesDept] = useState<"gs" | "offer">("gs");
  const [stagesUserId, setStagesUserId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: allUsers } = useListUsers({ query: { enabled: isManager } });

  const perfParams = {
    ...(deptFilter ? { department: deptFilter } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  };
  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ["/api/reports/performance", perfParams],
    queryFn: () => fetchReport("/reports/performance", perfParams),
    enabled: isManager,
  });

  const timingParams = {
    department: timingDept,
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  };
  const { data: staffTiming, isLoading: timingLoading } = useQuery({
    queryKey: ["/api/reports/staff-timing", timingParams],
    queryFn: () => fetchReport("/reports/staff-timing", timingParams),
    enabled: isManager && reportTab === "timing",
  });

  const stageParams = {
    department: stagesDept,
    ...(stagesUserId ? { user_id: stagesUserId } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  };
  const { data: stageData, isLoading: stageLoading } = useQuery({
    queryKey: ["/api/reports/stage-analysis", stageParams],
    queryFn: () => fetchReport("/reports/stage-analysis", stageParams),
    enabled: isManager && reportTab === "stages",
  });

  const hasDateFilter = dateFrom || dateTo;
  const clearDates = () => { setDateFrom(""); setDateTo(""); };

  if (!isManager) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2 max-w-md">Only managers and administrators can view performance reports.</p>
        </div>
      </Layout>
    );
  }

  const maxAssigned = Math.max(1, ...(performance?.map((p: any) => p.total_assigned) || [0]));
  const maxActive = Math.max(1, ...(performance?.map((p: any) => p.active_count) || [0]));
  const maxHandling = Math.max(1, ...(staffTiming?.map((p: any) => p.avg_handling_days ?? 0) || [0]));
  const maxStageDays = Math.max(1, ...(stageData?.map((s: any) => s.avg_days ?? 0) || [0]));

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Performance Reports</h1>
            <p className="text-muted-foreground mt-1">Workload analytics, handling time, and stage bottleneck analysis.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reportTab === "workload" && (
              <div className="flex gap-2 bg-muted/40 border border-border rounded-xl overflow-hidden p-1">
                {(["", "gs", "offer"] as const).map((d) => (
                  <button key={d} onClick={() => setDeptFilter(d)}
                    className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      deptFilter === d ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {d === "" ? "All Depts" : d === "gs" ? "GS Dept" : "Offer Dept"}
                  </button>
                ))}
              </div>
            )}
            {reportTab === "timing" && (
              <div className="flex gap-2 bg-muted/40 border border-border rounded-xl overflow-hidden p-1">
                {(["gs", "offer"] as const).map((d) => (
                  <button key={d} onClick={() => setTimingDept(d)}
                    className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      timingDept === d ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {d === "gs" ? "GS Dept" : "Offer Dept"}
                  </button>
                ))}
              </div>
            )}
            {reportTab === "stages" && (
              <div className="flex gap-2 bg-muted/40 border border-border rounded-xl overflow-hidden p-1">
                {(["gs", "offer"] as const).map((d) => (
                  <button key={d} onClick={() => setStagesDept(d)}
                    className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      stagesDept === d ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {d === "gs" ? "GS Dept" : "Offer Dept"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date range filter bar — always visible */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarRange className="w-4 h-4" />
            <span className="text-xs font-medium">Date Range</span>
          </div>
          <DateInput label="From" value={dateFrom} onChange={setDateFrom} />
          <DateInput label="To" value={dateTo} onChange={setDateTo} />
          {hasDateFilter && (
            <button onClick={clearDates}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="w-3 h-3" />Clear
            </button>
          )}
          {reportTab === "stages" && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Users className="w-4 h-4 text-muted-foreground" />
              <select
                value={stagesUserId}
                onChange={e => setStagesUserId(e.target.value)}
                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Staff</option>
                {allUsers?.map((u: any) => (
                  <option key={u.id} value={String(u.id)}>{u.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Report Type Tabs */}
        <div className="flex gap-1 border-b border-border shrink-0">
          {[
            { id: "workload" as ReportTab, label: "Workload Overview", icon: BarChart3 },
            { id: "timing" as ReportTab, label: "Staff Handling Time", icon: Clock },
            { id: "stages" as ReportTab, label: "Stage Analysis", icon: Layers },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => changeReportTab(tab.id)}
                className={cn(
                  "px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2",
                  reportTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Workload Overview ── */}
        {reportTab === "workload" && (
          <>
            {performance && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="w-6 h-6 text-primary" /></div>
                  <div><div className="text-2xl font-bold">{performance.length}</div><div className="text-sm text-muted-foreground">Staff Members</div></div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><FileText className="w-6 h-6 text-blue-600" /></div>
                  <div><div className="text-2xl font-bold">{performance.reduce((sum: number, p: any) => sum + p.total_assigned, 0)}</div><div className="text-sm text-muted-foreground">Total Applications</div></div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-orange-600" /></div>
                  <div><div className="text-2xl font-bold text-orange-700">{performance.reduce((sum: number, p: any) => sum + p.active_count, 0)}</div><div className="text-sm text-muted-foreground">Active Workload</div></div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                  <div><div className="text-2xl font-bold text-green-700">{performance.reduce((sum: number, p: any) => sum + p.completed_count, 0)}</div><div className="text-sm text-muted-foreground">Completed</div></div>
                </Card>
              </div>
            )}
            <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="table-container flex-1 h-full border-0 rounded-none">
                <table className="spreadsheet-table w-full">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Role</th>
                      <th className="text-center">Total</th>
                      <th className="text-center text-orange-700">Active</th>
                      <th className="text-center text-green-700">Completed</th>
                      <th className="text-center">GS Total</th>
                      <th className="text-center">Offer Total</th>
                      <th style={{ minWidth: "200px" }}>Active Workload</th>
                      <th>Status Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfLoading ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading report...</td></tr>
                    ) : performance?.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No data found.</td></tr>
                    ) : (
                      performance?.map((p: any) => {
                        const pct = Math.round((p.active_count / maxActive) * 100);
                        const roleBadge = ROLE_BADGE[p.role] || { label: p.role, cls: "bg-slate-100 text-slate-600" };
                        return (
                          <tr key={p.user_id} className="align-top">
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">{p.full_name.charAt(0)}</div>
                                <span className="font-semibold">{p.full_name}</span>
                              </div>
                            </td>
                            <td><span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", roleBadge.cls)}>{roleBadge.label}</span></td>
                            <td className="text-center font-bold text-lg">{p.total_assigned}</td>
                            <td className="text-center">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 min-w-[28px]">{p.active_count}</span>
                            </td>
                            <td className="text-center">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 min-w-[28px]">{p.completed_count}</span>
                            </td>
                            <td className="text-center text-blue-700 font-semibold">{p.gs_count}</td>
                            <td className="text-center text-violet-700 font-semibold">{p.offer_count}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full transition-all", pct > 75 ? "bg-red-500" : pct > 50 ? "bg-orange-400" : "bg-primary")}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-14 shrink-0">{p.active_count} ({pct}%)</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(p.status_breakdown).map(([status, count]) => (
                                  <span key={status} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                    <span>{status}</span>
                                    <span className="font-bold text-foreground">{count as number}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── Staff Handling Time ── */}
        {reportTab === "timing" && (
          <>
            {staffTiming && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><Users className="w-6 h-6 text-blue-600" /></div>
                  <div><div className="text-2xl font-bold">{staffTiming.reduce((s: number, p: any) => s + p.total_gs, 0)}</div><div className="text-sm text-muted-foreground">Total {timingDept === "gs" ? "GS" : "Offer"} Apps</div></div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                  <div><div className="text-2xl font-bold">{staffTiming.reduce((s: number, p: any) => s + p.completed_gs, 0)}</div><div className="text-sm text-muted-foreground">Completed</div></div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Timer className="w-6 h-6 text-amber-600" /></div>
                  <div><div className="text-2xl font-bold">{staffTiming.reduce((s: number, p: any) => s + p.pending_gs, 0)}</div><div className="text-sm text-muted-foreground">Pending</div></div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Clock className="w-6 h-6 text-primary" /></div>
                  <div>
                    <div className="text-2xl font-bold">
                      {fmtDays(staffTiming.filter((p: any) => p.avg_handling_days).reduce((s: number, p: any, _: number, arr: any[]) => s + (p.avg_handling_days ?? 0) / arr.filter((x: any) => x.avg_handling_days).length, 0) || null)}
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Handling Time</div>
                  </div>
                </Card>
              </div>
            )}
            <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="table-container flex-1 h-full border-0 rounded-none">
                <table className="spreadsheet-table w-full">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Role</th>
                      <th className="text-center">{timingDept === "gs" ? "GS" : "Offer"} Total</th>
                      <th className="text-center">Pending</th>
                      <th className="text-center">Completed</th>
                      <th style={{ minWidth: "200px" }}>Avg Handling Time</th>
                      <th style={{ minWidth: "180px" }}>Avg Completion</th>
                      <th style={{ minWidth: "180px" }}>Avg First Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timingLoading ? (
                      <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading timing data...</td></tr>
                    ) : staffTiming?.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No data found.</td></tr>
                    ) : (
                      staffTiming?.map((p: any) => {
                        const roleBadge = ROLE_BADGE[p.role] || { label: p.role, cls: "bg-slate-100 text-slate-600" };
                        return (
                          <tr key={p.user_id} className="align-middle">
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">{p.full_name.charAt(0)}</div>
                                <span className="font-semibold">{p.full_name}</span>
                              </div>
                            </td>
                            <td><span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", roleBadge.cls)}>{roleBadge.label}</span></td>
                            <td className="text-center font-bold">{p.total_gs}</td>
                            <td className="text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{p.pending_gs}</span>
                            </td>
                            <td className="text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{p.completed_gs}</span>
                            </td>
                            <td><DaysBar days={p.avg_handling_days} max={maxHandling} /></td>
                            <td><DaysBar days={p.avg_completion_days} max={maxHandling} color="bg-violet-500" /></td>
                            <td><DaysBar days={p.avg_first_action_days} max={maxHandling} color="bg-amber-500" /></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── Stage Analysis ── */}
        {reportTab === "stages" && (
          <>
            {stageData && stageData.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><Layers className="w-6 h-6 text-blue-600" /></div>
                  <div><div className="text-2xl font-bold">{stageData.length}</div><div className="text-sm text-muted-foreground">Total Stages</div></div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-amber-600" /></div>
                  <div>
                    <div className="text-2xl font-bold">{fmtDays(Math.max(...stageData.map((s: any) => s.avg_days ?? 0)))}</div>
                    <div className="text-sm text-muted-foreground">Longest Avg Stage</div>
                  </div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                  <div>
                    <div className="text-2xl font-bold">{stageData.reduce((s: number, x: any) => s + x.currently_in_stage, 0)}</div>
                    <div className="text-sm text-muted-foreground">Apps in Stages</div>
                  </div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0"><Timer className="w-6 h-6 text-red-500" /></div>
                  <div>
                    {(() => {
                      const bottleneck = [...stageData].sort((a: any, b: any) => {
                        const scoreB = (b.avg_days ?? 0) * b.currently_in_stage;
                        const scoreA = (a.avg_days ?? 0) * a.currently_in_stage;
                        if (scoreB !== scoreA) return scoreB - scoreA;
                        return b.currently_in_stage - a.currently_in_stage;
                      })[0];
                      return bottleneck ? (
                        <>
                          <div className="text-sm font-bold">{bottleneck.status}</div>
                          <div className="text-xs text-muted-foreground">{bottleneck.currently_in_stage} apps · {fmtDays(bottleneck.avg_days)} avg</div>
                        </>
                      ) : <div className="text-sm font-bold">—</div>;
                    })()}
                    <div className="text-sm text-muted-foreground mt-0.5">Biggest Bottleneck</div>
                  </div>
                </Card>
              </div>
            )}
            <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="table-container flex-1 h-full border-0 rounded-none">
                <table className="spreadsheet-table w-full">
                  <thead>
                    <tr>
                      <th>Stage / Status</th>
                      <th className="text-center">Currently Here</th>
                      <th className="text-center">Transitions</th>
                      <th style={{ minWidth: "220px" }}>Avg Time in Stage</th>
                      <th className="text-center">Min</th>
                      <th className="text-center">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageLoading ? (
                      <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading stage data...</td></tr>
                    ) : stageData?.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No stage data. Status changes will populate this as applications move through stages.</td></tr>
                    ) : (
                      [...(stageData || [])].sort((a: any, b: any) => (b.avg_days ?? 0) - (a.avg_days ?? 0)).map((stage: any) => {
                        const isBottleneck = (stage.avg_days ?? 0) >= maxStageDays * 0.75;
                        return (
                          <tr key={stage.status} className="align-middle">
                            <td>
                              <div className="flex items-center gap-2">
                                {isBottleneck && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                <span className="font-semibold">{stage.status}</span>
                              </div>
                            </td>
                            <td className="text-center">
                              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", stage.currently_in_stage > 0 ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground")}>
                                {stage.currently_in_stage}
                              </span>
                            </td>
                            <td className="text-center text-muted-foreground">{stage.total_transitions}</td>
                            <td>
                              <DaysBar
                                days={stage.avg_days}
                                max={maxStageDays}
                                color={isBottleneck ? "bg-red-400" : "bg-primary"}
                              />
                            </td>
                            <td className="text-center text-sm text-muted-foreground">{fmtDays(stage.min_days)}</td>
                            <td className="text-center text-sm text-muted-foreground">{fmtDays(stage.max_days)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
