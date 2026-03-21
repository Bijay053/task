import { useListUsers, useUpdateAvailability } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { Select } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/lib/permission-context";
import { ShieldAlert, Calendar, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available", className: "bg-green-100 text-green-700" },
  { value: "on_leave", label: "On Leave", className: "bg-yellow-100 text-yellow-700" },
  { value: "off_duty", label: "Off Duty", className: "bg-red-100 text-red-700" },
];

const availabilityStyle = (v: string) =>
  AVAILABILITY_OPTIONS.find(o => o.value === v)?.className || "bg-slate-100 text-slate-600";

const AvailabilityIcon = ({ status }: { status: string }) => {
  if (status === "available") return <Wifi className="w-4 h-4 text-green-600" />;
  if (status === "on_leave") return <Calendar className="w-4 h-4 text-yellow-600" />;
  return <WifiOff className="w-4 h-4 text-red-500" />;
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-indigo-100 text-indigo-700",
  team_leader: "bg-emerald-100 text-emerald-700",
  agent: "bg-slate-100 text-slate-600",
};

export default function LeavePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const availMut = useUpdateAvailability();

  const { isCustomRole, canView } = usePermissions();
  const canEdit = user?.role === "admin" || user?.role === "manager" || user?.role === "team_leader" || (isCustomRole && canView("leave"));
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager" || (isCustomRole && canView("leave"));

  if (!isAdminOrManager) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2 max-w-md">Only managers and administrators can view leave management.</p>
        </div>
      </Layout>
    );
  }

  const summary = {
    available: users?.filter(u => (u.availability_status || "available") === "available").length ?? 0,
    on_leave: users?.filter(u => u.availability_status === "on_leave").length ?? 0,
    off_duty: users?.filter(u => u.availability_status === "off_duty").length ?? 0,
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="shrink-0">
          <h1 className="text-3xl font-display font-bold tracking-tight">Leave & Availability</h1>
          <p className="text-muted-foreground mt-1">Track and manage staff availability, leaves, and duty status.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 shrink-0">
          <Card className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <Wifi className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">{summary.available}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-700">{summary.on_leave}</div>
              <div className="text-sm text-muted-foreground">On Leave</div>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <WifiOff className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{summary.off_duty}</div>
              <div className="text-sm text-muted-foreground">Off Duty</div>
            </div>
          </Card>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="table-container flex-1 h-full border-0 rounded-none">
            <table className="spreadsheet-table w-full">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Current Status</th>
                  <th>Update Availability</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Loading...</td></tr>
                ) : users?.map(u => {
                  const status = u.availability_status || "available";
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold shrink-0">
                            {u.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold">{u.full_name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider", ROLE_COLORS[u.role] || "bg-slate-100 text-slate-600")}>
                          {u.role}
                        </span>
                      </td>
                      <td className="text-muted-foreground text-sm">{u.email}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <AvailabilityIcon status={status} />
                          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", availabilityStyle(status))}>
                            {AVAILABILITY_OPTIONS.find(o => o.value === status)?.label || "Available"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {canEdit ? (
                          <Select
                            value={status}
                            onChange={async (e) => {
                              await availMut.mutateAsync({ userId: u.id, data: { availability_status: e.target.value } });
                              queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                            }}
                            className="text-xs h-8 min-w-[140px]"
                          >
                            {AVAILABILITY_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">No permission</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
