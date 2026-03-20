import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForgotPassword, useResetPassword, useVerifyOtp } from "@workspace/api-client-react";
import { Button, Input, Label, Card } from "@/components/ui-elements";
import { Files, Lock, Mail, ArrowLeft, KeyRound, ShieldCheck, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type Step = "credentials" | "otp" | "forgot" | "reset" | "forgot_done" | "password_expired";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get("token") || ""
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [expiredCurrentPassword, setExpiredCurrentPassword] = useState("");
  const [expiredNewPassword, setExpiredNewPassword] = useState("");
  const [expiredConfirmPassword, setExpiredConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const forgotMut    = useForgotPassword();
  const resetMut     = useResetPassword();
  const verifyOtpMut = useVerifyOtp();

  // Auto-jump to reset step when token in URL
  useState(() => {
    if (resetToken) setStep("reset");
  });

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await login({ email, password });
      if (result?.otp_required) {
        setInfo(result.message || "Check your email for a verification code.");
        setStep("otp");
      } else if (result?.password_expired) {
        setStep("password_expired");
      }
      // Otherwise useAuth has already navigated to "/"
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpiredPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (expiredNewPassword !== expiredConfirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ current_password: expiredCurrentPassword, new_password: expiredNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to change password");
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result: any = await verifyOtpMut.mutateAsync({ email, code: otpCode });
      if (result.access_token) {
        localStorage.setItem("access_token", result.access_token);
        if (result.password_expired) {
          setStep("password_expired");
        } else {
          window.location.href = "/";
        }
      }
    } catch (err: any) {
      setError(err.message || "Invalid or expired code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await forgotMut.mutateAsync({ email });
      setStep("forgot_done");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    try {
      await resetMut.mutateAsync({ token: resetToken, new_password: newPassword });
      setInfo("Password reset successfully. You can now sign in.");
      setStep("credentials");
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err: any) {
      setError(err.message || "Invalid or expired link");
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
          <h1 className="text-3xl font-display font-bold text-white mb-2 tracking-tight">
            {step === "credentials"      && "Welcome Back"}
            {step === "otp"              && "Verify Your Identity"}
            {step === "forgot"           && "Reset Password"}
            {step === "forgot_done"      && "Check Your Email"}
            {step === "reset"            && "Set New Password"}
            {step === "password_expired" && "Password Expired"}
          </h1>
          <p className="text-slate-400">
            {step === "credentials"      && "Sign in to the Task Management Portal"}
            {step === "otp"              && "Enter the code sent to your email"}
            {step === "forgot"           && "We'll send a reset link to your email"}
            {step === "forgot_done"      && "A password reset link has been sent"}
            {step === "reset"            && "Choose a new password for your account"}
            {step === "password_expired" && "Your password must be updated every 90 days"}
          </p>
        </div>

        <Card className="p-8 glass-panel border-white/10 bg-white/5">
          {/* Error / info banner */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive mr-2" />
              {error}
            </div>
          )}
          {info && !error && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
              {info}
            </div>
          )}

          {/* ── Step: credentials ── */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-200">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary"
                    placeholder="admin@taskportal.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary"
                    placeholder="••••••••" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => { setError(""); setStep("forgot"); }}
                  className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full text-lg h-12" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          )}

          {/* ── Step: OTP ── */}
          {step === "otp" && (
            <form onSubmit={handleOtp} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-200">Verification Code</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                    required value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-10 bg-white/10 border-white/10 text-white text-xl tracking-widest text-center font-bold placeholder:text-slate-500 focus-visible:border-primary"
                    placeholder="000000" autoFocus />
                </div>
                <p className="text-xs text-slate-400">Code expires in 10 minutes.</p>
              </div>
              <Button type="submit" className="w-full text-lg h-12" isLoading={isLoading}>
                Verify & Sign In
              </Button>
              <button type="button" onClick={() => { setStep("credentials"); setOtpCode(""); setError(""); setInfo(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-white mt-1">
                <ArrowLeft className="w-4 h-4" />Back to sign in
              </button>
            </form>
          )}

          {/* ── Step: forgot password ── */}
          {step === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-200">Your Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary"
                    placeholder="you@example.com" />
                </div>
              </div>
              <Button type="submit" className="w-full text-lg h-12" isLoading={isLoading || forgotMut.isPending}>
                Send Reset Link
              </Button>
              <button type="button" onClick={() => { setStep("credentials"); setError(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" />Back to sign in
              </button>
            </form>
          )}

          {/* ── Step: forgot done ── */}
          {step === "forgot_done" && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                If <strong className="text-white">{email}</strong> is registered, a password reset link has been sent.
                Please check your inbox (and spam folder).
              </p>
              <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/10"
                onClick={() => { setStep("credentials"); setError(""); setInfo(""); }}>
                <ArrowLeft className="w-4 h-4 mr-2" />Back to Sign In
              </Button>
            </div>
          )}

          {/* ── Step: reset password ── */}
          {step === "reset" && (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-200">New Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary"
                    placeholder="••••••••" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Confirm Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className={cn("pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary",
                      confirmPassword && confirmPassword !== newPassword && "border-destructive")}
                    placeholder="••••••••" />
                </div>
              </div>
              <Button type="submit" className="w-full text-lg h-12" isLoading={isLoading || resetMut.isPending}>
                Set New Password
              </Button>
            </form>
          )}

          {/* ── Step: password expired (force change) ── */}
          {step === "password_expired" && (
            <form onSubmit={handleExpiredPasswordChange} className="space-y-5">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Your password is over 90 days old and must be changed before you can continue. Please choose a strong new password.</span>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Current Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="password" required value={expiredCurrentPassword} onChange={e => setExpiredCurrentPassword(e.target.value)}
                    className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary"
                    placeholder="Your current password" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">New Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="password" required value={expiredNewPassword} onChange={e => setExpiredNewPassword(e.target.value)}
                    className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary"
                    placeholder="Min 8 chars, upper, lower, number, symbol" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Confirm New Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input type="password" required value={expiredConfirmPassword} onChange={e => setExpiredConfirmPassword(e.target.value)}
                    className={cn("pl-10 bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus-visible:border-primary",
                      expiredConfirmPassword && expiredConfirmPassword !== expiredNewPassword && "border-destructive")}
                    placeholder="••••••••" />
                </div>
              </div>
              <Button type="submit" className="w-full text-lg h-12" isLoading={isLoading}>
                Update Password & Sign In
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
