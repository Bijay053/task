import React, { useState } from "react";
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

// ─── Status classification ──────────────────────────────────────────────────
const GS_ACTIVE_SET = new Set([
  "In Review", "GS submitted", "GS onhold",
  "GS document pending", "GS additional document request",
  "Refund Requested", "CoE Requested", "Visa Lodged",
]);
const GS_POSITIVE_SET = new Set(["GS approved", "CoE Approved", "Visa Granted"]);
const GS_NEGATIVE_SET = new Set(["GS Rejected", "Visa Refused", "Withdrawn"]);
const OFFER_ACTIVE_SET = new Set(["Document Requested", "On Hold", "Offer Request", "Enquiries"]);
const OFFER_POSITIVE_SET = new Set(["Offer Received"]);
const OFFER_NEGATIVE_SET = new Set(["Offer Rejected", "Not Eligible"]);

function statusBadgeCls(status: string): string {
  if (GS_ACTIVE_SET.has(status) || OFFER_ACTIVE_SET.has(status))
    return "bg-amber-50 text-amber-700 border border-amber-200";
  if (GS_POSITIVE_SET.has(status) || OFFER_POSITIVE_SET.has(status))
    return "bg-green-50 text-green-700 border border-green-200";
  if (GS_NEGATIVE_SET.has(status) || OFFER_NEGATIVE_SET.has(status))
    return "bg-red-50 text-red-600 border border-red-200";
  return "bg-muted text-muted-foreground";
}

// ─── Display-name aliases (UI only — DB values never change) ────────────────
const STATUS_DISPLAY: Record<string, string> = {
  "Offer Request":      "Offer Requested",
  "Document Requested": "Docs Pending",
};
function displayStatus(status: string): string {
  return STATUS_DISPLAY[status] ?? status;
}

// Grouped status breakdown: Active / Completed ✓ / Closed ✕ / Special
// Groups are WORKFLOW-ORIENTED (not dept-oriented) so managers see open vs done instantly.
const STATUS_GROUPS: { label: string; cls: string; statuses: string[] }[] = [
  {
    // All statuses where work is still in progress (GS + CoE/Visa + Offer)
    label: "Active",
    cls: "bg-amber-100 text-amber-800",
    statuses: [
      "In Review", "GS submitted", "GS onhold",
      "GS document pending", "GS additional document request",
      "CoE Requested", "Visa Lodged",
      "Enquiries", "Offer Request", "Document Requested", "On Hold",
    ],
  },
  {
    // Positive final outcomes — case successfully closed
    label: "Completed ✓",
    cls: "bg-green-100 text-green-800",
    statuses: ["GS approved", "CoE Approved", "Visa Granted", "Offer Received"],
  },
  {
    // Negative final outcomes — rejected, refused, or withdrawn
    label: "Closed ✕",
    cls: "bg-red-100 text-red-700",
    statuses: ["GS Rejected", "Visa Refused", "Withdrawn", "Offer Rejected", "Not Eligible"],
  },
  {
    // Edge cases that need special attention
    label: "Special",
    cls: "bg-violet-100 text-violet-800",
    statuses: ["Refund Requested"],
  },
];

function GroupedBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const rendered: string[] = [];
  const sections: React.ReactNode[] = [];

  STATUS_GROUPS.forEach(group => {
    const items = group.statuses
      .filter(s => breakdown[s] != null && breakdown[s] > 0)
      .map(s => ({ status: s, count: breakdown[s] }));
    if (items.length === 0) return;
    items.forEach(i => rendered.push(i.status));
    sections.push(
      <div key={group.label} className="flex flex-wrap gap-1 items-center">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0", group.cls)}>
          {group.label}
        </span>
        {items.map(({ status, count }) => (
          <span key={status} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", statusBadgeCls(status))}>
            <span>{displayStatus(status)}</span>
            <span className="font-bold">{count}</span>
          </span>
        ))}
      </div>
    );
  });

  // Any leftover statuses not in any group
  const leftover = Object.entries(breakdown)
    .filter(([s, c]) => !rendered.includes(s) && c > 0);
  if (leftover.length > 0) {
    sections.push(
      <div key="_other" className="flex flex-wrap gap-1 items-center">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 bg-slate-100 text-slate-600">Other</span>
        {leftover.map(([status, count]) => (
          <span key={status} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", statusBadgeCls(status))}>
            <span>{displayStatus(status)}</span>
            <span className="font-bold">{count}</span>
          </span>
        ))}
      </div>
    );
  }

  return <div className="flex flex-col gap-1.5">{sections}</div>;
}

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
            {performance && (() => {
              const totalApps = performance.reduce((s: number, p: any) => s + p.total_assigned, 0);
              const totalActive = performance.reduce((s: number, p: any) => s + p.active_count, 0);
              const totalCompleted = performance.reduce((s: number, p: any) => s + p.completed_count, 0);
              const totalOther = performance.reduce((s: number, p: any) => s + (p.other_count ?? 0), 0);
              const totalWeighted = performance.reduce((s: number, p: any) => s + (p.weighted_workload ?? 0), 0);

              // Workload % bar: relative to the busiest staff member (dynamic max)
              const maxActive = Math.max(1, ...performance.map((p: any) => p.active_count ?? 0));
              const maxWeighted = Math.max(1, ...performance.map((p: any) => p.weighted_workload ?? 0));

              // Offer conversion rate
              const totalOfferPositive = performance.reduce((s: number, p: any) =>
                s + (p.status_breakdown?.["Offer Received"] ?? 0), 0);
              const totalOfferNeg = performance.reduce((s: number, p: any) =>
                s + (p.status_breakdown?.["Offer Rejected"] ?? 0) + (p.status_breakdown?.["Not Eligible"] ?? 0), 0);
              const conversionRate = (totalOfferPositive + totalOfferNeg) > 0
                ? Math.round((totalOfferPositive / (totalOfferPositive + totalOfferNeg)) * 100)
                : null;

              // GS approval rate
              const totalGSApproved = performance.reduce((s: number, p: any) =>
                s + (p.status_breakdown?.["GS approved"] ?? 0), 0);
              const totalGSRejected = performance.reduce((s: number, p: any) =>
                s + (p.status_breakdown?.["GS Rejected"] ?? 0), 0);
              const gsApprovalRate = (totalGSApproved + totalGSRejected) > 0
                ? Math.round((totalGSApproved / (totalGSApproved + totalGSRejected)) * 100)
                : null;

              const showGSDept = !deptFilter || deptFilter === "gs";
              const showOfferDept = !deptFilter || deptFilter === "offer";
              const colSpanCount = 8 + (showGSDept && showOfferDept ? 2 : 1);

              return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="w-6 h-6 text-primary" /></div>
                      <div>
                        <div className="text-2xl font-bold">{totalApps}</div>
                        <div className="text-sm text-muted-foreground">Total Applications</div>
                        <div className="text-xs text-muted-foreground">
                          {totalActive} active · {totalCompleted} completed
                          {totalOther > 0 && <span className="text-amber-600"> · {totalOther} other</span>}
                        </div>
                      </div>
                    </Card>
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-orange-600" /></div>
                      <div>
                        <div className="text-2xl font-bold text-orange-700">{totalActive}</div>
                        <div className="text-sm text-muted-foreground">Active Workload</div>
                        <div className="text-xs text-muted-foreground">
                          {totalApps > 0
                            ? `${Math.round((totalActive / totalApps) * 100)}% of total applications`
                            : "excludes completed"}
                        </div>
                      </div>
                    </Card>
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                      <div>
                        <div className="text-2xl font-bold text-green-700">{totalCompleted}</div>
                        <div className="text-sm text-muted-foreground">Completed</div>
                      </div>
                    </Card>
                    {/* 4th card: Weighted Workload Score */}
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0"><BarChart3 className="w-6 h-6 text-purple-600" /></div>
                      <div>
                        <div className="text-2xl font-bold text-purple-700">{totalWeighted}</div>
                        <div className="text-sm text-muted-foreground">Weighted Load Score</div>
                        <div className="text-xs text-muted-foreground">GS×3 · Visa×2 · Offer×1</div>
                      </div>
                    </Card>
                  </div>

                  {/* Secondary metric: Approval / Conversion rate */}
                  {(deptFilter === "offer" || deptFilter === "gs") && (
                    <div className="shrink-0">
                      <Card className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
                        {deptFilter === "offer" ? (
                          <div>
                            <span className="font-bold text-blue-700 text-xl">{conversionRate !== null ? `${conversionRate}%` : "—"}</span>
                            <span className="text-sm text-muted-foreground ml-2">Offer Conversion Rate</span>
                            <span className="text-xs text-muted-foreground ml-2">({totalOfferPositive} received / {totalOfferPositive + totalOfferNeg} decided)</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-blue-700 text-xl">{gsApprovalRate !== null ? `${gsApprovalRate}%` : "—"}</span>
                            <span className="text-sm text-muted-foreground ml-2">GS Approval Rate</span>
                            <span className="text-xs text-muted-foreground ml-2">({totalGSApproved} approved / {totalGSApproved + totalGSRejected} decided)</span>
                          </div>
                        )}
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
                            <th className="text-center text-amber-700">
                              <div>Active</div>
                              <div className="font-normal text-xs">(in-progress only)</div>
                            </th>
                            <th className="text-center text-green-700">Completed</th>
                            {showGSDept && showOfferDept && <th className="text-center">GS Total</th>}
                            {showGSDept && showOfferDept && <th className="text-center">Offer Total</th>}
                            <th style={{ minWidth: "200px" }}>
                              <div>Active Workload %</div>
                              <div className="font-normal text-xs text-muted-foreground">share of total active</div>
                            </th>
                            <th style={{ minWidth: "200px" }}>
                              <div>Weighted Score</div>
                              <div className="font-normal text-xs text-muted-foreground">share of total · GS×3 · Visa×2 · Offer×1</div>
                            </th>
                            <th style={{ minWidth: "320px" }}>Status Breakdown</th>
                          </tr>
                        </thead>
                        <tbody>
                          {perfLoading ? (
                            <tr><td colSpan={colSpanCount} className="text-center py-12 text-muted-foreground">Loading report...</td></tr>
                          ) : performance?.length === 0 ? (
                            <tr><td colSpan={colSpanCount} className="text-center py-12 text-muted-foreground">No data found.</td></tr>
                          ) : (
                            performance?.map((p: any) => {
                              const pct = totalActive > 0 ? Math.round((p.active_count / totalActive) * 100) : 0;
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
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 min-w-[28px]">{p.active_count}</span>
                                  </td>
                                  <td className="text-center">
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 min-w-[28px]">{p.completed_count}</span>
                                  </td>
                                  {showGSDept && showOfferDept && <td className="text-center text-blue-700 font-semibold">{p.gs_count}</td>}
                                  {showGSDept && showOfferDept && <td className="text-center text-violet-700 font-semibold">{p.offer_count}</td>}
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full transition-all", pct > 75 ? "bg-red-500" : pct > 50 ? "bg-orange-400" : "bg-primary")}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground w-16 shrink-0">{p.active_count} ({pct}%)</span>
                                    </div>
                                  </td>
                                  <td>
                                    {(() => {
                                      const wScore = p.weighted_workload ?? 0;
                                      const wPct = totalWeighted > 0 ? Math.round((wScore / totalWeighted) * 100) : 0;
                                      return (
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                                            <div
                                              className={cn("h-full rounded-full transition-all", wPct > 75 ? "bg-purple-600" : wPct > 50 ? "bg-purple-400" : "bg-purple-300")}
                                              style={{ width: `${wPct}%` }}
                                            />
                                          </div>
                                          <span className="text-xs text-muted-foreground w-16 shrink-0">{wScore} ({wPct}%)</span>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td>
                                    <GroupedBreakdown breakdown={p.status_breakdown} />
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
              );
            })()}
          </>
        )}

        {/* ── Staff Handling Time ── */}
        {reportTab === "timing" && (
          <>
            {staffTiming && (() => {
              const totalApps = staffTiming.reduce((s: number, p: any) => s + p.total_gs, 0);
              const totalCompleted = staffTiming.reduce((s: number, p: any) => s + p.completed_gs, 0);
              const totalPending = staffTiming.reduce((s: number, p: any) => s + p.pending_gs, 0);
              const totalSLABreach = staffTiming.reduce((s: number, p: any) => s + (p.sla_breach_count ?? 0), 0);
              const slaTarget = staffTiming[0]?.sla_target_days ?? 2;

              const withHandling = staffTiming.filter((p: any) => p.avg_handling_days != null);
              const overallAvgHandling = withHandling.length
                ? withHandling.reduce((s: number, p: any) => s + p.avg_handling_days, 0) / withHandling.length
                : null;
              const withCompletion = staffTiming.filter((p: any) => p.avg_completion_days != null);
              const overallAvgCompletion = withCompletion.length
                ? withCompletion.reduce((s: number, p: any) => s + p.avg_completion_days, 0) / withCompletion.length
                : null;

              const maxCompletion = Math.max(1, ...staffTiming.map((p: any) => p.avg_completion_days ?? 0));

              return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><Users className="w-6 h-6 text-blue-600" /></div>
                      <div>
                        <div className="text-2xl font-bold">{totalApps}</div>
                        <div className="text-sm text-muted-foreground">Total {timingDept === "gs" ? "GS Stage" : "Offer Stage"} Apps</div>
                        <div className="text-xs text-muted-foreground">{totalCompleted} completed · {totalPending} pending</div>
                      </div>
                    </Card>
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Clock className="w-6 h-6 text-primary" /></div>
                      <div>
                        <div className="text-2xl font-bold">{fmtDays(overallAvgHandling)}</div>
                        <div className="text-sm text-muted-foreground">Avg Handling Time</div>
                        <div className="text-xs text-muted-foreground">all cases incl. pending</div>
                      </div>
                    </Card>
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                      <div>
                        <div className="text-2xl font-bold">{fmtDays(overallAvgCompletion)}</div>
                        <div className="text-sm text-muted-foreground">Avg Completion Time</div>
                        <div className="text-xs text-muted-foreground">completed cases only</div>
                      </div>
                    </Card>
                    <Card className={cn("p-5 flex items-center gap-4", totalSLABreach > 0 ? "border-red-200 bg-red-50/30" : "")}>
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", totalSLABreach > 0 ? "bg-red-100" : "bg-green-100")}>
                        <AlertTriangle className={cn("w-6 h-6", totalSLABreach > 0 ? "text-red-500" : "text-green-600")} />
                      </div>
                      <div>
                        <div className={cn("text-2xl font-bold", totalSLABreach > 0 ? "text-red-600" : "text-green-700")}>{totalSLABreach}</div>
                        <div className="text-sm text-muted-foreground">SLA Breaches</div>
                        <div className="text-xs text-muted-foreground">target: {slaTarget}d per case</div>
                      </div>
                    </Card>
                  </div>

                  <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <div className="table-container flex-1 h-full border-0 rounded-none">
                      <table className="spreadsheet-table w-full">
                        <thead>
                          <tr>
                            <th>Staff Member</th>
                            <th>Role</th>
                            <th className="text-center">{timingDept === "gs" ? "GS Stage" : "Offer Stage"} Total</th>
                            <th className="text-center text-amber-700">Pending</th>
                            <th className="text-center text-green-700">Completed</th>
                            <th style={{ minWidth: "180px" }}>
                              <div>Pending Workload</div>
                              <div className="font-normal text-xs text-muted-foreground">pending / max pending</div>
                            </th>
                            <th style={{ minWidth: "190px" }}>
                              <div>Avg Handling Time</div>
                              <div className="font-normal text-xs text-muted-foreground">all cases incl. pending</div>
                            </th>
                            <th style={{ minWidth: "190px" }}>
                              <div>Avg Completion Time</div>
                              <div className="font-normal text-xs text-muted-foreground">completed only</div>
                            </th>
                            <th style={{ minWidth: "180px" }}>
                              <div>Avg First Action</div>
                              <div className="font-normal text-xs text-muted-foreground">first non-final touch</div>
                            </th>
                            <th className="text-center">
                              <div>Performance</div>
                              <div className="font-normal text-xs text-muted-foreground">SLA + outliers</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {timingLoading ? (
                            <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Loading timing data...</td></tr>
                          ) : staffTiming?.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No data found.</td></tr>
                          ) : (() => {
                            const maxPending = Math.max(1, ...staffTiming.map((p: any) => p.pending_gs ?? 0));
                            return staffTiming?.map((p: any) => {
                              const roleBadge = ROLE_BADGE[p.role] || { label: p.role, cls: "bg-slate-100 text-slate-600" };
                              const pendPct = Math.round(((p.pending_gs ?? 0) / maxPending) * 100);
                              const breachCount = p.sla_breach_count ?? 0;
                              const outlierCount = p.outlier_count ?? 0;
                              const slaBreachPct = p.total_gs > 0 ? Math.round((breachCount / p.total_gs) * 100) : 0;

                              // SLA traffic-light based on avg_completion_days
                              const compDays = p.avg_completion_days;
                              const perfStatus = compDays == null ? null
                                : compDays <= 1   ? "good"
                                : compDays <= 2   ? "slow"
                                : "critical";

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
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                                        (p.pending_gs ?? 0) > 40
                                          ? "bg-red-100 text-red-700 font-bold"
                                          : "bg-amber-100 text-amber-700"
                                      )}>{p.pending_gs}</span>
                                      {(p.pending_gs ?? 0) > 40 && (
                                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Overloaded</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-center">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{p.completed_gs}</span>
                                  </td>
                                  {/* Pending Workload % bar */}
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full transition-all",
                                            pendPct >= 100 ? "bg-red-500" : pendPct > 60 ? "bg-orange-400" : "bg-blue-500")}
                                          style={{ width: `${pendPct}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground w-16 shrink-0">{p.pending_gs} ({pendPct}%)</span>
                                    </div>
                                  </td>
                                  <td><DaysBar days={p.avg_handling_days} max={maxHandling} /></td>
                                  <td><DaysBar days={p.avg_completion_days} max={maxCompletion} color="bg-violet-500" /></td>
                                  <td>
                                    {p.avg_first_action_days == null ? (
                                      <span className="text-xs text-muted-foreground italic">single-step closes</span>
                                    ) : (
                                      <DaysBar days={p.avg_first_action_days} max={Math.max(1, maxHandling / 4)} color="bg-amber-500" />
                                    )}
                                  </td>
                                  {/* Performance: traffic light + SLA + outliers */}
                                  <td>
                                    <div className="flex flex-col items-start gap-1">
                                      {perfStatus && (
                                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
                                          perfStatus === "good"     ? "bg-green-100 text-green-700"
                                          : perfStatus === "slow"   ? "bg-amber-100 text-amber-700"
                                          : "bg-red-100 text-red-700"
                                        )}>
                                          {perfStatus === "good" ? "✓ Good" : perfStatus === "slow" ? "⚠ Slow" : "✕ Critical"}
                                        </span>
                                      )}
                                      {breachCount > 0 && (
                                        <span className="text-xs text-red-600">{breachCount} SLA breach ({slaBreachPct}%)</span>
                                      )}
                                      {outlierCount > 0 && (
                                        <span className="text-xs text-amber-600">⚠ {outlierCount} case{outlierCount > 1 ? "s" : ""} &gt;30d</span>
                                      )}
                                      {perfStatus === null && breachCount === 0 && (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              );
            })()}
          </>
        )}

        {/* ── Stage Analysis ── */}
        {reportTab === "stages" && (
          <>
            {stageData && stageData.length > 0 && (() => {
              const activeStages = stageData.filter((s: any) => s.is_active_stage);
              const outcomeStatuses = stageData.filter((s: any) => !s.is_active_stage);
              const bottleneck = [...activeStages].sort((a: any, b: any) => (b.avg_days ?? 0) - (a.avg_days ?? 0))[0];
              const maxActiveAvg = Math.max(1, ...activeStages.map((s: any) => s.avg_days ?? 0));
              const totalCurrently = activeStages.reduce((s: number, x: any) => s + x.currently_in_stage, 0);

              return (
                <>
                  {/* ── Summary cards: pipeline overview ── */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><Users className="w-6 h-6 text-blue-600" /></div>
                      <div>
                        <div className="text-2xl font-bold">{totalCurrently}</div>
                        <div className="text-sm text-muted-foreground">Currently in Pipeline</div>
                        <div className="text-xs text-muted-foreground">active stages only</div>
                      </div>
                    </Card>
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6 text-amber-600" /></div>
                      <div>
                        {bottleneck ? (
                          <>
                            <div className="text-base font-bold leading-tight">{bottleneck.status}</div>
                            <div className="text-xs text-muted-foreground">{bottleneck.currently_in_stage} apps · {fmtDays(bottleneck.avg_days)} avg</div>
                          </>
                        ) : <div className="text-2xl font-bold">—</div>}
                        <div className="text-xs text-muted-foreground mt-0.5">Bottleneck Stage</div>
                      </div>
                    </Card>
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Clock className="w-6 h-6 text-primary" /></div>
                      <div>
                        <div className="text-2xl font-bold">{fmtDays(bottleneck?.avg_days ?? null)}</div>
                        <div className="text-sm text-muted-foreground font-medium truncate max-w-[160px]" title={bottleneck?.status}>
                          {bottleneck?.status ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">Longest Avg Stage</div>
                      </div>
                    </Card>
                    <Card className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Layers className="w-6 h-6 text-slate-500" /></div>
                      <div>
                        <div className="text-2xl font-bold">{activeStages.length}</div>
                        <div className="text-sm text-muted-foreground">Active Process Stages</div>
                        <div className="text-xs text-muted-foreground">{outcomeStatuses.length} final outcome{outcomeStatuses.length !== 1 ? "s" : ""}</div>
                      </div>
                    </Card>
                  </div>

                  {/* ── Final Outcomes summary card (separate from stages) ── */}
                  {outcomeStatuses.length > 0 && (
                    <Card className="p-4 shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-sm">Final Outcomes</span>
                        <span className="text-xs text-muted-foreground ml-1">— completed applications, no longer in the pipeline</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {outcomeStatuses.map((stage: any) => {
                          const isPositive = /received|approved|granted/i.test(stage.status);
                          const isNegative = /rejected|refused|not eligible|withdrawn/i.test(stage.status);
                          const cls = isPositive
                            ? "bg-green-50 border-green-200 text-green-800"
                            : isNegative
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-slate-50 border-slate-200 text-slate-700";
                          return (
                            <div key={stage.status} className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg border", cls)}>
                              <div>
                                <div className="text-xs font-medium opacity-80">{stage.status}</div>
                                <div className="text-xl font-bold leading-tight">{stage.total_transitions}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* ── Active Process Stages table (no outcome rows) ── */}
                  <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <div className="table-container flex-1 h-full border-0 rounded-none">
                      <table className="spreadsheet-table w-full">
                        <thead>
                          <tr>
                            <th>Process Stage</th>
                            <th className="text-center">Currently Here</th>
                            <th className="text-center">
                              <div>Stage Entries</div>
                              <div className="font-normal text-xs text-muted-foreground">(incl. revisits)</div>
                            </th>
                            <th style={{ minWidth: "220px" }}>
                              <div>Avg Time in Stage</div>
                              <div className="font-normal text-xs text-muted-foreground">mean (exit−entry per case)</div>
                            </th>
                            <th className="text-center">
                              <div>Median</div>
                              <div className="font-normal text-xs text-muted-foreground">50th pct</div>
                            </th>
                            <th className="text-center">
                              <div>P90</div>
                              <div className="font-normal text-xs text-muted-foreground">90th pct</div>
                            </th>
                            <th className="text-center">Min</th>
                            <th className="text-center">Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stageLoading ? (
                            <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading stage data...</td></tr>
                          ) : activeStages.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No stage data yet. Status changes will populate this as applications move through stages.</td></tr>
                          ) : (() => {
                            const maxP90 = Math.max(1, ...activeStages.map((s: any) => s.p90_days ?? 0));
                            return [...activeStages].sort((a: any, b: any) => (b.avg_days ?? 0) - (a.avg_days ?? 0)).map((stage: any) => {
                              const isBottleneck = bottleneck?.status === stage.status;
                              // SLA indicator: p90 > 2 days = critical, > 1 day = slow
                              const p90 = stage.p90_days;
                              const slaStatus = p90 == null ? null : p90 > 2 ? "critical" : p90 > 1 ? "slow" : "good";
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
                                      max={maxActiveAvg}
                                      color={isBottleneck ? "bg-red-400" : "bg-primary"}
                                    />
                                  </td>
                                  {/* Median */}
                                  <td className="text-center">
                                    <span className="text-sm font-semibold text-slate-700">{fmtDays(stage.median_days)}</span>
                                  </td>
                                  {/* P90 with SLA colour */}
                                  <td className="text-center">
                                    {p90 == null ? (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    ) : (
                                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold",
                                        slaStatus === "good"     ? "bg-green-100 text-green-700"
                                        : slaStatus === "slow"   ? "bg-amber-100 text-amber-700"
                                        : "bg-red-100 text-red-700"
                                      )}>
                                        {fmtDays(p90)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-center text-sm text-muted-foreground">{fmtDays(stage.min_days)}</td>
                                  <td className="text-center text-sm text-muted-foreground">{fmtDays(stage.max_days)}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              );
            })()}
          </>
        )}
      </div>
    </Layout>
  );
}
