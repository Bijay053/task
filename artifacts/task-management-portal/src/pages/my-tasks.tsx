import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, StatusBadge } from "@/components/ui-elements";
import { KanbanBoard } from "@/components/kanban-board";
import { useMyApplications } from "@workspace/api-client-react";
import { format } from "date-fns";
import { LayoutGrid, List } from "lucide-react";
import { cn, GS_STATUS_CHOICES, GS_STATUS_COLORS, OFFER_STATUS_CHOICES, OFFER_STATUS_COLORS } from "@/lib/utils";

type ViewMode = "table" | "kanban";
type DeptTab = "gs" | "offer";

export default function MyTasks() {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [dept, setDept] = useState<DeptTab>("gs");

  const { data: gsApps, isLoading: gsLoading } = useMyApplications({ department: "gs" });
  const { data: offerApps, isLoading: offerLoading } = useMyApplications({ department: "offer" });

  const applications = dept === "gs" ? gsApps : offerApps;
  const isLoading = dept === "gs" ? gsLoading : offerLoading;
  const statusChoices = dept === "gs" ? GS_STATUS_CHOICES : OFFER_STATUS_CHOICES;
  const statusColors = dept === "gs" ? GS_STATUS_COLORS : OFFER_STATUS_COLORS;

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">My Tasks</h1>
            <p className="text-muted-foreground mt-1">Applications currently assigned to you.</p>
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

        {/* Department tabs */}
        <div className="flex gap-1 border-b border-border shrink-0">
          <button
            onClick={() => setDept("gs")}
            className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px", dept === "gs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            GS Department
            {gsApps && <span className="ml-2 text-xs font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{gsApps.length}</span>}
          </button>
          <button
            onClick={() => setDept("offer")}
            className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px", dept === "offer" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            Offer Department
            {offerApps && <span className="ml-2 text-xs font-normal bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{offerApps.length}</span>}
          </button>
        </div>

        {viewMode === "table" ? (
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="table-container flex-1 h-full border-0 rounded-none">
              <table className="spreadsheet-table w-full h-full">
                <thead>
                  <tr>
                    <th className="w-12 text-center">ID</th>
                    <th>Student Name</th>
                    <th>University &amp; Course</th>
                    <th>Intake</th>
                    {dept === "offer" && <th>Channel</th>}
                    <th>Status</th>
                    {dept === "gs" && <th>Priority</th>}
                    <th>Assigned Date</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading your tasks...</td></tr>
                  ) : applications?.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No {dept === "gs" ? "GS" : "Offer"} tasks assigned to you.</td></tr>
                  ) : (
                    applications?.map((app) => (
                      <tr key={app.id} className="hover:bg-muted/30">
                        <td className="text-center text-muted-foreground text-xs">{app.id}</td>
                        <td className="font-semibold">{app.student?.full_name}</td>
                        <td>
                          <div className="font-medium text-primary">{app.university?.name || "-"}</div>
                          <div className="text-xs text-muted-foreground">{app.course || "-"}</div>
                        </td>
                        <td>{app.intake || "-"}</td>
                        {dept === "offer" && (
                          <td>
                            {(app as any).channel ? (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">{(app as any).channel}</span>
                            ) : "-"}
                          </td>
                        )}
                        <td><StatusBadge status={app.application_status} department={dept} /></td>
                        {dept === "gs" && (
                          <td>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${app.priority === "high" ? "bg-red-100 text-red-700" : app.priority === "low" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"}`}>
                              {app.priority || "normal"}
                            </span>
                          </td>
                        )}
                        <td className="text-muted-foreground text-sm">
                          {app.assigned_date ? format(new Date(app.assigned_date), "MMM d, yyyy") : "-"}
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
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
