import { Layout } from "@/components/layout";
import { Card, Button, Input, Label, StatusBadge } from "@/components/ui-elements";
import { STATUS_CHOICES } from "@/lib/utils";
import { BellRing, ShieldAlert } from "lucide-react";
import { useTestEmail, useTestChat } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { isAdminOrManager } = useAuth();
  const { toast } = useToast();
  const testEmail = useTestEmail();
  const testChat = useTestChat();

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
      toast({ title: "Success", description: "Test chat message sent successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message || "Failed to send chat message" });
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1">Configure integrations and view system dictionaries.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center mb-6">
                <BellRing className="w-5 h-5 text-primary mr-2" />
                <h3 className="font-display font-semibold text-lg">Test Integrations</h3>
              </div>
              
              <form onSubmit={handleTestEmail} className="space-y-4 mb-8">
                <h4 className="text-sm font-semibold text-slate-700">Email SMTP</h4>
                <div className="flex gap-2">
                  <Input name="target" placeholder="admin@example.com" type="email" required className="flex-1" />
                  <Button type="submit" isLoading={testEmail.isPending} variant="secondary">Send Test</Button>
                </div>
                <p className="text-xs text-muted-foreground">Backend must have SMTP_HOST, SMTP_USER, etc. env vars set.</p>
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
          </div>

          <div>
            <Card className="p-6 h-full">
              <h3 className="font-display font-semibold text-lg mb-6">Status Dictionary Reference</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The following application statuses are hardcoded into the system with their corresponding badge colors. 
                These cannot be changed by agents.
              </p>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {STATUS_CHOICES.map(status => (
                  <div key={status} className="flex items-center justify-between p-3 rounded-lg border border-border bg-slate-50/50">
                    <span className="font-medium text-sm">{status}</span>
                    <StatusBadge status={status} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
