import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, StatusBadge } from "@/components/ui-elements";
import { KanbanBoard } from "@/components/kanban-board";
import { useMyApplications } from "@workspace/api-client-react";
import { format } from "date-fns";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "kanban";

export default function MyTasks() {
  const { data: applications, isLoading } = useMyApplications();
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">My Tasks</h1>
            <p className="text-muted-foreground mt-1">Applications currently assigned to you.</p>
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                viewMode === "table"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                viewMode === "kanban"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Board
            </button>
          </div>
        </div>

        {viewMode === "table" ? (
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
                    <th>Priority</th>
                    <th>Assigned Date</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading your tasks...</td></tr>
                  ) : applications?.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">You have no assigned tasks. Excellent!</td></tr>
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
                        <td><StatusBadge status={app.application_status} /></td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${app.priority === "high" ? "bg-red-100 text-red-700" : app.priority === "low" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"}`}>
                            {app.priority || "normal"}
                          </span>
                        </td>
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
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading board...
              </div>
            ) : (
              <KanbanBoard
                applications={applications || []}
                queryInvalidateKeys={["/api/applications/my"]}
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
