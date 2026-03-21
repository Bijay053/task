import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface LogEntry {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by_user?: { id: number; full_name: string; email: string } | null;
}

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    application_status: "Status",
    assigned_to_id: "Assignee",
    application_created: "Created",
  };
  return map[field] || field.replace(/_/g, " ");
}

function resolveUserId(id: string | null, users?: any[]): string {
  if (!id || id === "null" || id === "None") return "Unassigned";
  if (!users) return `#${id}`;
  const u = users.find((u: any) => u.id === Number(id));
  return u ? u.full_name : `User #${id}`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeEntry(log: LogEntry, users?: any[]): string {
  if (log.field_name === "application_created") {
    return `Application created${log.new_value ? ` with status "${log.new_value}"` : ""}`;
  }
  if (log.field_name === "application_status") {
    return `Status: "${log.old_value || "—"}" → "${log.new_value || "—"}"`;
  }
  if (log.field_name === "assigned_to_id") {
    return `Assigned: ${resolveUserId(log.old_value, users)} → ${resolveUserId(log.new_value, users)}`;
  }
  return `${fieldLabel(log.field_name)}: ${log.old_value || "—"} → ${log.new_value || "—"}`;
}

export function ApplicationHistory({ appId, users }: { appId: number; users?: any[] }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) return;
    const token = localStorage.getItem("access_token");
    setLoading(true);
    fetch(`/api/applications/${appId}/logs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [appId]);

  return (
    <div className="border-t pt-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Activity History</span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading history…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <div className="max-h-52 overflow-y-auto pr-1 space-y-0">
          {logs.map((log, i) => (
            <div key={log.id} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center pt-1">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                {i < logs.length - 1 && <div className="w-px flex-1 bg-border min-h-[16px]" />}
              </div>
              <div className="pb-3 min-w-0">
                <p className="text-foreground leading-snug text-sm">{describeEntry(log, users)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.changed_by_user?.full_name || "System"} · {formatDate(log.changed_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
