import { useState, Fragment } from "react";
import { useListUsers, useUpdateAvailability } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { Select } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/lib/permission-context";
import { ShieldAlert, Calendar, Wifi, WifiOff, Clock, Pencil, Check, X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserOut } from "@workspace/api-client-react";

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

const DAYS = [
  { key: "mon", label: "M", title: "Mon" },
  { key: "tue", label: "T", title: "Tue" },
  { key: "wed", label: "W", title: "Wed" },
  { key: "thu", label: "T", title: "Thu" },
  { key: "fri", label: "F", title: "Fri" },
  { key: "sat", label: "S", title: "Sat" },
  { key: "sun", label: "S", title: "Sun" },
];

function parseDays(workDays: string | null | undefined): Set<string> {
  if (!workDays) return new Set();
  return new Set(workDays.split(",").map(d => d.trim().toLowerCase()).filter(Boolean));
}

function formatSchedule(u: UserOut): string {
  const parts: string[] = [];
  if (u.work_days) {
    const set = parseDays(u.work_days);
    const dayLabels = DAYS.filter(d => set.has(d.key)).map(d => d.title);
    if (dayLabels.length > 0) parts.push(dayLabels.join(" "));
  }
  if (u.work_start_time && u.work_end_time) {
    parts.push(`${u.work_start_time} – ${u.work_end_time}`);
  }
  return parts.length > 0 ? parts.join("  ·  ") : "";
}

const TIMEZONES = [
  { value: "Asia/Kathmandu",      label: "Nepal (NPT, UTC+5:45)" },
  { value: "Asia/Kolkata",        label: "India (IST, UTC+5:30)" },
  { value: "Australia/Sydney",    label: "Australia/Sydney (AEDT/AEST)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEDT/AEST)" },
  { value: "Australia/Brisbane",  label: "Australia/Brisbane (AEST, UTC+10)" },
  { value: "Australia/Perth",     label: "Australia/Perth (AWST, UTC+8)" },
  { value: "Europe/London",       label: "UK (GMT/BST)" },
  { value: "America/Toronto",     label: "Canada/Toronto (ET)" },
  { value: "America/Vancouver",   label: "Canada/Vancouver (PT)" },
  { value: "America/New_York",    label: "US/New York (ET)" },
  { value: "America/Los_Angeles", label: "US/Los Angeles (PT)" },
  { value: "Asia/Dubai",          label: "UAE (GST, UTC+4)" },
  { value: "Asia/Singapore",      label: "Singapore (SGT, UTC+8)" },
  { value: "UTC",                 label: "UTC" },
];

function tzLabel(tz: string | null | undefined): string {
  if (!tz) return "";
  return TIMEZONES.find(t => t.value === tz)?.label.split(" ")[0] ?? tz;
}

interface ScheduleForm {
  days: Set<string>;
  start: string;
  end: string;
  timezone: string;
}

export default function LeavePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const availMut = useUpdateAvailability();

  const { isCustomRole, canView } = usePermissions();
  const canEdit = user?.role === "admin" || user?.role === "manager" || user?.role === "team_leader" || (isCustomRole && canView("leave"));
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager" || (isCustomRole && canView("leave"));

  const [editingId, setEditingId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({ days: new Set(), start: "", end: "" });
  const [savingId, setSavingId] = useState<number | null>(null);

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

  function startEdit(u: UserOut) {
    setEditingId(u.id);
    setScheduleForm({
      days: parseDays(u.work_days),
      start: u.work_start_time || "",
      end: u.work_end_time || "",
      timezone: u.work_timezone || "",
    });
  }

  function toggleDay(key: string) {
    setScheduleForm(prev => {
      const next = new Set(prev.days);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...prev, days: next };
    });
  }

  async function saveSchedule(userId: number) {
    setSavingId(userId);
    try {
      const workDays = DAYS.filter(d => scheduleForm.days.has(d.key)).map(d => d.key).join(",");
      await availMut.mutateAsync({
        userId,
        data: {
          work_days: workDays || null,
          work_start_time: scheduleForm.start || null,
          work_end_time: scheduleForm.end || null,
          work_timezone: scheduleForm.timezone || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="shrink-0">
          <h1 className="text-3xl font-display font-bold tracking-tight">Leave & Availability</h1>
          <p className="text-muted-foreground mt-1">Track and manage staff availability, leaves, and working schedules.</p>
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
                  <th>Current Status</th>
                  <th>Update Status</th>
                  <th>Working Days</th>
                  <th>Working Hours</th>
                  <th className="text-center w-36">Show in Dashboard</th>
                  {canEdit && <th className="w-20">Schedule</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</td></tr>
                ) : users?.map(u => {
                  const status = u.availability_status || "available";
                  const isEditing = editingId === u.id;

                  return (
                    <Fragment key={u.id}>
                      <tr>
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
                        <td>
                          {u.work_days ? (
                            <div className="flex gap-0.5 flex-wrap">
                              {DAYS.map(d => (
                                <span
                                  key={d.key}
                                  title={d.title}
                                  className={cn(
                                    "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center",
                                    parseDays(u.work_days).has(d.key)
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-400"
                                  )}
                                >
                                  {d.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not set</span>
                          )}
                        </td>
                        <td>
                          {u.work_start_time && u.work_end_time ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                {u.work_start_time} – {u.work_end_time}
                              </div>
                              {u.work_timezone && (
                                <span className="text-xs text-muted-foreground pl-5">{tzLabel(u.work_timezone)}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not set</span>
                          )}
                        </td>
                        <td className="text-center">
                          {canEdit ? (
                            <button
                              onClick={async () => {
                                await availMut.mutateAsync({
                                  userId: u.id,
                                  data: { show_in_availability: !u.show_in_availability },
                                });
                                queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                              }}
                              title={u.show_in_availability ? "Click to hide from Dashboard" : "Click to show in Dashboard"}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer",
                                u.show_in_availability
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              )}
                            >
                              {u.show_in_availability
                                ? <><Eye className="w-3.5 h-3.5" /> Visible</>
                                : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>}
                            </button>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                              u.show_in_availability ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            )}>
                              {u.show_in_availability ? <><Eye className="w-3.5 h-3.5" /> Visible</> : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>}
                            </span>
                          )}
                        </td>
                        {canEdit && (
                          <td>
                            {isEditing ? (
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            ) : (
                              <button
                                onClick={() => startEdit(u)}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                          </td>
                        )}
                      </tr>

                      {isEditing && (
                        <tr className="bg-blue-50/60">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="flex flex-wrap items-end gap-6">
                              {/* Day picker */}
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Working Days</div>
                                <div className="flex gap-1">
                                  {DAYS.map(d => (
                                    <button
                                      key={d.key}
                                      type="button"
                                      title={d.title}
                                      onClick={() => toggleDay(d.key)}
                                      className={cn(
                                        "w-8 h-8 rounded-lg text-xs font-bold transition-colors",
                                        scheduleForm.days.has(d.key)
                                          ? "bg-blue-600 text-white shadow-sm"
                                          : "bg-white border border-slate-200 text-slate-500 hover:border-blue-400"
                                      )}
                                    >
                                      {d.title}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Time range */}
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Work Start Time</div>
                                <input
                                  type="time"
                                  value={scheduleForm.start}
                                  onChange={e => setScheduleForm(p => ({ ...p, start: e.target.value }))}
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Work End Time</div>
                                <input
                                  type="time"
                                  value={scheduleForm.end}
                                  onChange={e => setScheduleForm(p => ({ ...p, end: e.target.value }))}
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                              </div>

                              <div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Time Zone</div>
                                <select
                                  value={scheduleForm.timezone}
                                  onChange={e => setScheduleForm(p => ({ ...p, timezone: e.target.value }))}
                                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[220px]"
                                >
                                  <option value="">— Select timezone —</option>
                                  {TIMEZONES.map(tz => (
                                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 pb-0.5">
                                <button
                                  onClick={() => saveSchedule(u.id)}
                                  disabled={savingId === u.id}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {savingId === u.id ? "Saving…" : "Save Schedule"}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
