import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Label, Modal, Select, StatusBadge } from "@/components/ui-elements";
import { BellRing, ShieldAlert, Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown, Layers, Webhook, Save, Pin, Check } from "lucide-react";
import {
  useTestEmail, useTestChat, useListStatuses, useCreateStatus,
  useUpdateStatus, useDeleteStatus, useReorderStatuses,
  useGetDeptSettings, useSetDeptSetting,
} from "@workspace/api-client-react";
import type { AppStatusOut } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type SettingsTab = "notifications" | "gs-statuses" | "offer-statuses" | "webhooks";

function DeptWebhooksPanel({ department, label }: { department: string; label: string }) {
  const { data: settings } = useGetDeptSettings(department);
  const setSettingMut = useSetDeptSetting();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const webhookValue = settings?.find(s => s.key === "google_chat_webhook")?.value || "";
  const [val, setVal] = useState<string | undefined>(undefined);
  const current = val !== undefined ? val : webhookValue;

  const save = async () => {
    await setSettingMut.mutateAsync({ department, key: "google_chat_webhook", data: { value: current || null } });
    queryClient.invalidateQueries({ queryKey: [`/api/dept-settings/${department}`] });
    toast({ title: "Saved", description: `${label} webhook updated.` });
    setVal(undefined);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Webhook className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">{label} Webhooks</h3>
      </div>
      <div className="space-y-2">
        <Label>Google Chat Webhook URL</Label>
        <div className="flex gap-2">
          <Input
            value={current}
            onChange={e => setVal(e.target.value)}
            placeholder="https://chat.googleapis.com/v1/spaces/..."
            className="flex-1 font-mono text-xs"
          />
          <Button onClick={save} isLoading={setSettingMut.isPending} variant="secondary">
            <Save className="w-4 h-4 mr-1.5" />Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">This webhook will be used for sending {label} notifications to Google Chat. Leave blank to disable.</p>
      </div>
    </Card>
  );
}

function StatusRow({
  status,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  status: AppStatusOut;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (s: AppStatusOut) => void;
  onDelete: (id: number) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group">
      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold flex-1 min-w-0 truncate"
        style={{ backgroundColor: status.bg_color, color: status.text_color }}
      >
        {status.name}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMoveUp(status.id)}
          disabled={isFirst}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onMoveDown(status.id)}
          disabled={isLast}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onEdit(status)} className="p-1 rounded hover:bg-muted text-blue-600" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(status.id)} className="p-1 rounded hover:bg-muted text-red-500" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function StatusManager({ department }: { department: "gs" | "offer" }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: statuses, isLoading } = useListStatuses({ department });
  const { data: deptSettings } = useGetDeptSettings(department);
  const setSettingMut = useSetDeptSetting();
  const createMut = useCreateStatus();
  const updateMut = useUpdateStatus();
  const deleteMut = useDeleteStatus();
  const reorderMut = useReorderStatuses();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<AppStatusOut | null>(null);
  const [name, setName] = useState("");
  const [bgColor, setBgColor] = useState("#f1f5f9");
  const [textColor, setTextColor] = useState("#000000");

  const openCreate = () => { setEditingStatus(null); setName(""); setBgColor("#f1f5f9"); setTextColor("#000000"); setIsModalOpen(true); };
  const openEdit = (s: AppStatusOut) => { setEditingStatus(s); setName(s.name); setBgColor(s.bg_color); setTextColor(s.text_color); setIsModalOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "Name is required" }); return; }
    try {
      if (editingStatus) {
        await updateMut.mutateAsync({ statusId: editingStatus.id, data: { name: name.trim(), bg_color: bgColor, text_color: textColor } });
        toast({ title: "Status updated" });
      } else {
        await createMut.mutateAsync({ data: { department, name: name.trim(), bg_color: bgColor, text_color: textColor } });
        toast({ title: "Status created" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/statuses"] });
      setIsModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this status?")) return;
    await deleteMut.mutateAsync({ statusId: id });
    queryClient.invalidateQueries({ queryKey: ["/api/statuses"] });
    toast({ title: "Status deleted" });
  };

  const moveStatus = async (id: number, direction: "up" | "down") => {
    if (!statuses) return;
    const idx = statuses.findIndex(s => s.id === id);
    if (idx < 0) return;
    const newList = [...statuses];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newList.length) return;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    await reorderMut.mutateAsync({ data: { ordered_ids: newList.map(s => s.id) } });
    queryClient.invalidateQueries({ queryKey: ["/api/statuses"] });
  };

  const tabStatusesSetting = deptSettings?.find(s => s.key === `${department}_tab_statuses`)?.value || "";
  const pinnedSet = new Set(tabStatusesSetting ? tabStatusesSetting.split(",").map((s: string) => s.trim()).filter(Boolean) : []);

  const toggleTabStatus = async (statusName: string) => {
    const updated = new Set(pinnedSet);
    if (updated.has(statusName)) {
      updated.delete(statusName);
    } else {
      updated.add(statusName);
    }
    const value = Array.from(updated).join(",");
    await setSettingMut.mutateAsync({ department, key: `${department}_tab_statuses`, data: { value: value || null } });
    queryClient.invalidateQueries({ queryKey: [`/api/dept-settings/${department}`] });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading statuses...</div>;

  return (
    <>
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{statuses?.length || 0} statuses configured. Drag or use arrows to reorder.</p>
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Add Status</Button>
        </div>
        <div className="space-y-2">
          {statuses?.map((s, i) => (
            <StatusRow
              key={s.id}
              status={s}
              isFirst={i === 0}
              isLast={i === (statuses.length - 1)}
              onEdit={openEdit}
              onDelete={handleDelete}
              onMoveUp={(id) => moveStatus(id, "up")}
              onMoveDown={(id) => moveStatus(id, "down")}
            />
          ))}
          {statuses?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No statuses yet. Add one above.</div>
          )}
        </div>
      </div>

      {/* Quick Filter Tabs section — admin can pin statuses as tabs in the applications page */}
      {department === "gs" && (
        <div className="border-t pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Quick Filter Tabs</h4>
          </div>
          <p className="text-xs text-muted-foreground">Select which statuses appear as pinned quick-filter tabs at the top of the GS Applications page.</p>
          <div className="flex flex-wrap gap-2">
            {statuses?.map(s => {
              const isPinned = pinnedSet.has(s.name);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleTabStatus(s.name)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                    isPinned
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {isPinned && <Check className="w-3.5 h-3.5" />}
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.bg_color }}
                  />
                  {s.name}
                </button>
              );
            })}
          </div>
          {pinnedSet.size > 0 && (
            <p className="text-xs text-primary">{pinnedSet.size} status{pinnedSet.size !== 1 ? "es" : ""} pinned as tabs.</p>
          )}
        </div>
      )}
    </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingStatus ? "Edit Status" : "Add New Status"}>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Status Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GS Approved" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                <Input value={bgColor} onChange={e => setBgColor(e.target.value)} className="font-mono text-sm" placeholder="#f1f5f9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                <Input value={textColor} onChange={e => setTextColor(e.target.value)} className="font-mono text-sm" placeholder="#000000" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: bgColor, color: textColor }}>
                {name || "Status Preview"}
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={createMut.isPending || updateMut.isPending}>
              {editingStatus ? "Save Changes" : "Create Status"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const testEmail = useTestEmail();
  const testChat = useTestChat();
  const [activeTab, setActiveTab] = useState<SettingsTab>("notifications");

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  if (!isAdminOrManager) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2 max-w-md">Only administrators can access system settings.</p>
        </div>
      </Layout>
    );
  }

  const handleTestEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await testEmail.mutateAsync({ data: { type: "email", target: fd.get("target") as string } });
      toast({ title: "Success", description: "Test email sent successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message || "Failed to send email" });
    }
  };

  const handleTestChat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await testChat.mutateAsync({ data: { type: "chat", target: fd.get("target") as string } });
      toast({ title: "Success", description: "Test chat message sent." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message || "Failed to send message" });
    }
  };

  const tabs = [
    { id: "notifications" as SettingsTab, label: "Notifications" },
    { id: "gs-statuses" as SettingsTab, label: "GS Statuses" },
    { id: "offer-statuses" as SettingsTab, label: "Offer Statuses" },
    { id: "webhooks" as SettingsTab, label: "Dept Webhooks" },
  ];

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1">Configure statuses, integrations, and permissions.</p>
        </div>

        <div className="flex gap-1 border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "notifications" && (
          <Card className="p-6 max-w-lg">
            <div className="flex items-center mb-6">
              <BellRing className="w-5 h-5 text-primary mr-2" />
              <h3 className="font-display font-semibold text-lg">Test Integrations</h3>
            </div>
            <form onSubmit={handleTestEmail} className="space-y-4 mb-8">
              <h4 className="text-sm font-semibold text-slate-700">Email (AWS SES)</h4>
              <div className="flex gap-2">
                <Input name="target" placeholder="admin@example.com" type="email" required className="flex-1" />
                <Button type="submit" isLoading={testEmail.isPending} variant="secondary">Send Test</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires <code className="bg-slate-100 px-1 rounded">AWS_ACCESS_KEY_ID</code>, <code className="bg-slate-100 px-1 rounded">AWS_SECRET_ACCESS_KEY</code>, <code className="bg-slate-100 px-1 rounded">AWS_REGION</code>, and <code className="bg-slate-100 px-1 rounded">SES_FROM_EMAIL</code> in <code className="bg-slate-100 px-1 rounded">/etc/task-portal.env</code>.
              </p>
            </form>
            <div className="w-full h-px bg-border my-6" />
            <form onSubmit={handleTestChat} className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700">Google Chat Webhook</h4>
              <div className="flex gap-2">
                <Input name="target" placeholder="https://chat.googleapis.com/v1/spaces/..." required className="flex-1" />
                <Button type="submit" isLoading={testChat.isPending} variant="secondary">Send Test</Button>
              </div>
            </form>
          </Card>
        )}

        {activeTab === "gs-statuses" && (
          <Card className="p-6">
            <div className="flex items-center mb-6">
              <Layers className="w-5 h-5 text-primary mr-2" />
              <h3 className="font-display font-semibold text-lg">GS Department Statuses</h3>
            </div>
            <StatusManager department="gs" />
          </Card>
        )}

        {activeTab === "offer-statuses" && (
          <Card className="p-6">
            <div className="flex items-center mb-6">
              <Layers className="w-5 h-5 text-primary mr-2" />
              <h3 className="font-display font-semibold text-lg">Offer Department Statuses</h3>
            </div>
            <StatusManager department="offer" />
          </Card>
        )}

        {activeTab === "webhooks" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-display font-semibold mb-1">Department-Specific Webhooks</h2>
              <p className="text-sm text-muted-foreground">Set different Google Chat webhooks for each department. Overrides the global env-var webhook for that department.</p>
            </div>
            <DeptWebhooksPanel department="gs" label="GS Department" />
            <DeptWebhooksPanel department="offer" label="Offer Department" />
          </div>
        )}

      </div>
    </Layout>
  );
}
