import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button, Input, Label, Card } from "@/components/ui-elements";
import { Files, Lock, Mail } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
      <img 
        src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
        alt="Background" 
        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 rotate-3 hover:rotate-0 transition-transform">
            <Files className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2 tracking-tight">Welcome Back</h1>
          <p className="text-slate-400">Sign in to the Task Management Portal</p>
        </div>

        <Card className="p-8 glass-panel border-white/10 bg-white/5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive mr-2" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-slate-200">Email Address</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <Input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary" 
                  placeholder="admin@taskportal.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-200">Password</Label>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <Input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary" 
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" className="w-full text-lg h-12 mt-4" isLoading={isLoading}>
              Sign In
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
