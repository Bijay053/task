import { useState } from "react";
import {
  useListAgents, useCreateAgent, useUpdateAgent,
  useListUsers, useGetManagerAgents, useAssignAgentToManager, useUnassignAgentFromManager
} from "@workspace/api-client-react";
import type { AgentOut } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Input, Label, Modal, Select, Textarea } from "@/components/ui-elements";
import { Plus, Edit2, Users, Globe, X, Check, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type AgentTab = "directory" | "manager-mapping";

function ManagerMappingPanel({ managerId, managerName, allAgents }: {
  managerId: number; managerName: string; allAgents: AgentOut[]
}) {
  const queryClient = useQueryClient();
  const { data: assignedAgents } = useGetManagerAgents(managerId);
  const assignMut = useAssignAgentToManager();
  const unassignMut = useUnassignAgentFromManager();

  const assignedIds = new Set(assignedAgents?.map(a => a.id) || []);

  const toggle = async (agentId: number) => {
    if (assignedIds.has(agentId)) {
      await unassignMut.mutateAsync({ managerId, agentId });
    } else {
      await assignMut.mutateAsync({ managerId, agentId });
    }
    queryClient.invalidateQueries({ queryKey: [`/api/agents/manager/${managerId}/agents`] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select which external agents {managerName} is responsible for. They will only see applications linked to those agents.</p>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {allAgents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">No agents in directory. Add agents first.</div>
        ) : (
          allAgents.map(agent => {
            const isAssigned = assignedIds.has(agent.id);
            return (
              <div
                key={agent.id}
                onClick={() => toggle(agent.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                  isAssigned ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  isAssigned ? "border-primary bg-primary text-white" : "border-border"
                )}>
                  {isAssigned && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{agent.name}</div>
                  {agent.company_name && <div className="text-xs text-muted-foreground">{agent.company_name}</div>}
                </div>
                {agent.country && <span className="text-xs text-muted-foreground shrink-0">{agent.country}</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function Agents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: agents, isLoading } = useListAgents();
  const { data: users } = useListUsers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentOut | null>(null);
  const [activeTab, setActiveTab] = useState<AgentTab>("directory");
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);

  const createMut = useCreateAgent();
  const updateMut = useUpdateAgent();

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const managers = users?.filter(u => ["admin", "manager"].includes(u.role)) || [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      name: fd.get("name") as string,
      company_name: fd.get("company_name") as string || undefined,
      email: fd.get("email") as string || undefined,
      phone: fd.get("phone") as string || undefined,
      country: fd.get("country") as string || undefined,
      notes: fd.get("notes") as string || undefined,
    };
    if (editingAgent) {
      await updateMut.mutateAsync({ agentId: editingAgent.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    setIsModalOpen(false);
  };

  if (!isAdminOrManager) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-2 max-w-md">Only managers can access the agent directory.</p>
        </div>
      </Layout>
    );
  }

  const selectedManager = managers.find(m => m.id === selectedManagerId);

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">External Agents</h1>
            <p className="text-muted-foreground mt-1">Manage sub-agents, partners, and their manager assignments.</p>
          </div>
          {activeTab === "directory" && (
            <Button onClick={() => { setEditingAgent(null); setIsModalOpen(true); }}>
              <Plus className="w-5 h-5 mr-2" />Add Agent
            </Button>
          )}
        </div>

        <div className="flex gap-1 border-b border-border shrink-0">
          {[{ id: "directory" as AgentTab, label: "Agent Directory" }, { id: "manager-mapping" as AgentTab, label: "Manager-Agent Mapping" }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "directory" && (
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="table-container flex-1 h-full border-0 rounded-none">
              <table className="spreadsheet-table w-full">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Agent Name</th>
                    <th>Company</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Country</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</td></tr>
                  ) : agents?.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No agents yet. Add one above.</td></tr>
                  ) : agents?.map(agent => (
                    <tr key={agent.id} className="cursor-pointer group" onClick={() => { setEditingAgent(agent); setIsModalOpen(true); }}>
                      <td className="text-muted-foreground text-xs">{agent.id}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                            {agent.name.charAt(0)}
                          </div>
                          <span className="font-semibold">{agent.name}</span>
                        </div>
                      </td>
                      <td>{agent.company_name || "-"}</td>
                      <td className="text-muted-foreground">{agent.email || "-"}</td>
                      <td className="text-muted-foreground">{agent.phone || "-"}</td>
                      <td>{agent.country ? <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{agent.country}</span> : "-"}</td>
                      <td>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", agent.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {agent.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setEditingAgent(agent); setIsModalOpen(true); }}>
                          <Edit2 className="w-4 h-4 mr-1" />Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "manager-mapping" && (
          <div className="flex gap-6 flex-1 min-h-0">
            <Card className="w-64 shrink-0 flex flex-col overflow-hidden">
              <div className="p-4 font-semibold text-sm text-muted-foreground border-b">Select Manager</div>
              <div className="flex-1 overflow-y-auto">
                {managers.map(m => (
                  <button key={m.id} onClick={() => setSelectedManagerId(m.id)}
                    className={cn("w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/50 cursor-pointer",
                      selectedManagerId === m.id && "bg-primary/5 border-l-2 border-l-primary")}>
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{m.full_name.charAt(0)}</div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="flex-1 p-6 overflow-y-auto">
              {selectedManager ? (
                <ManagerMappingPanel managerId={selectedManager.id} managerName={selectedManager.full_name} allAgents={agents || []} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Users className="w-12 h-12 mb-4 opacity-30" />
                  <p>Select a manager to configure their agent assignments.</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAgent ? "Edit Agent" : "New External Agent"} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Agent Name *</Label>
              <Input name="name" required defaultValue={editingAgent?.name || ""} placeholder="e.g. John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Company / Agency</Label>
              <Input name="company_name" defaultValue={editingAgent?.company_name || ""} placeholder="e.g. Global Study Partners" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={editingAgent?.email || ""} placeholder="agent@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" defaultValue={editingAgent?.phone || ""} placeholder="+61 400 000 000" />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input name="country" defaultValue={editingAgent?.country || ""} placeholder="e.g. Bangladesh" />
            </div>
            {editingAgent && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select name="is_active" defaultValue={editingAgent.is_active ? "true" : "false"}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea name="notes" defaultValue={editingAgent?.notes || ""} placeholder="Internal notes about this agent..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMut.isPending || updateMut.isPending}>
              {editingAgent ? "Save Changes" : "Create Agent"}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
