import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { useGetPerformanceReport } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3, ShieldAlert, Users, FileText, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin:       { label: "Admin", cls: "bg-violet-100 text-violet-700" },
  manager:     { label: "Manager", cls: "bg-blue-100 text-blue-700" },
  team_leader: { label: "Team Leader", cls: "bg-emerald-100 text-emerald-700" },
  agent:       { label: "Agent", cls: "bg-slate-100 text-slate-700" },
};

export default function Reports() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [deptFilter, setDeptFilter] = useState<"" | "gs" | "offer">("");

  const { data: performance, isLoading } = useGetPerformanceReport(
    deptFilter ? { department: deptFilter } : undefined,
    { query: { enabled: isManager } }
  );

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

  const maxAssigned = Math.max(1, ...(performance?.map(p => p.total_assigned) || [0]));

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Performance Reports</h1>
            <p className="text-muted-foreground mt-1">Track workload, assignments, and progress for each staff member.</p>
          </div>
          <div className="flex gap-2 bg-muted/40 border border-border rounded-xl overflow-hidden p-1">
            {(["", "gs", "offer"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  deptFilter === d ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d === "" ? "All Departments" : d === "gs" ? "GS Dept" : "Offer Dept"}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        {performance && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            <Card className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{performance.length}</div>
                <div className="text-sm text-muted-foreground">Staff Members</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{performance.reduce((sum, p) => sum + p.total_assigned, 0)}</div>
                <div className="text-sm text-muted-foreground">Total Applications</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{performance.reduce((sum, p) => sum + p.gs_count, 0)}</div>
                <div className="text-sm text-muted-foreground">GS Applications</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{performance.reduce((sum, p) => sum + p.offer_count, 0)}</div>
                <div className="text-sm text-muted-foreground">Offer Applications</div>
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
                  <th className="text-center">Total</th>
                  <th className="text-center">GS</th>
                  <th className="text-center">Offer</th>
                  <th style={{ minWidth: "200px" }}>Workload Bar</th>
                  <th>Status Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading report...</td></tr>
                ) : performance?.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No data found.</td></tr>
                ) : (
                  performance?.map((p) => {
                    const pct = Math.round((p.total_assigned / maxAssigned) * 100);
                    const roleBadge = ROLE_BADGE[p.role] || { label: p.role, cls: "bg-slate-100 text-slate-600" };
                    return (
                      <tr key={p.user_id} className="align-top">
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                              {p.full_name.charAt(0)}
                            </div>
                            <span className="font-semibold">{p.full_name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", roleBadge.cls)}>
                            {roleBadge.label}
                          </span>
                        </td>
                        <td className="text-center font-bold text-lg">{p.total_assigned}</td>
                        <td className="text-center text-blue-700 font-semibold">{p.gs_count}</td>
                        <td className="text-center text-violet-700 font-semibold">{p.offer_count}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 shrink-0">{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(p.status_breakdown).slice(0, 4).map(([status, count]) => (
                              <span
                                key={status}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                                title={status}
                              >
                                <span className="truncate max-w-[80px]">{status}</span>
                                <span className="font-bold text-foreground">{count}</span>
                              </span>
                            ))}
                            {Object.keys(p.status_breakdown).length > 4 && (
                              <span className="text-xs text-muted-foreground">+{Object.keys(p.status_breakdown).length - 4} more</span>
                            )}
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
      </div>
    </Layout>
  );
}
