import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForgotPassword, useResetPassword, useVerifyOtp } from "@workspace/api-client-react";
import { Button, Input, Label } from "@/components/ui-elements";
import {
  Files, Lock, Mail, ArrowLeft, KeyRound, ShieldCheck,
  AlertTriangle, Eye, EyeOff, CheckCircle2, GraduationCap,
  Globe, BarChart3, Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type Step = "credentials" | "otp" | "forgot" | "reset" | "forgot_done" | "password_expired";

function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
  required,
  minLength,
  autoFocus,
  icon: Icon = Lock,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
  icon?: React.ElementType;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
      <Input
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          "pl-10 pr-10 h-11 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20",
          className
        )}
        placeholder={placeholder || "••••••••"}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function EmailInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
      <Input
        type="email"
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20"
        placeholder={placeholder || "you@example.com"}
      />
    </div>
  );
}

const features = [
  { icon: GraduationCap, label: "Track student visa & university applications" },
  { icon: Globe,         label: "Manage GS & Offer department workflows" },
  { icon: BarChart3,     label: "Real-time performance analytics" },
  { icon: Users,         label: "Role-based team collaboration" },
];

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
      const res = await fetch(`/api/auth/change-password`, {
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

  const stepTitle: Record<Step, string> = {
    credentials:      "Welcome back",
    otp:              "Verify your identity",
    forgot:           "Reset your password",
    forgot_done:      "Check your inbox",
    reset:            "Set a new password",
    password_expired: "Password expired",
  };

  const stepSub: Record<Step, string> = {
    credentials:      "Sign in to your account to continue",
    otp:              "Enter the 6-digit code sent to your email",
    forgot:           "We'll send a reset link to your email",
    forgot_done:      "A reset link has been sent to your email",
    reset:            "Choose a strong new password",
    password_expired: "Your password must be updated before continuing",
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden flex-col justify-between p-12">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 25% 25%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 75% 75%, #6366f1 0%, transparent 50%)" }}
        />
        <div className="absolute inset-0"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Files className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">Admission Task</div>
              <div className="text-blue-300 text-sm">Management Portal</div>
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Streamline your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">
              admissions workflow
            </span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            The all-in-one platform for managing student visa and university applications.
          </p>
          <div className="space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-blue-300" />
                </div>
                <span className="text-slate-300 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            System Online · Secure connection
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-10 lg:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
            <Files className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">Admission Task Management</span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{stepTitle[step]}</h1>
            <p className="text-slate-500 text-sm">{stepSub[step]}</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {info && !error && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              {info}
            </div>
          )}

          {/* ── credentials ── */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">Email address</Label>
                <EmailInput value={email} onChange={setEmail} placeholder="admin@example.com" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-700 text-sm font-medium">Password</Label>
                  <button type="button" onClick={() => { setError(""); setStep("forgot"); }}
                    className="text-xs text-primary hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>
                <PasswordInput value={password} onChange={setPassword} required />
              </div>
              <Button type="submit" className="w-full h-11 text-base font-semibold" isLoading={isLoading}>
                Sign in
              </Button>
            </form>
          )}

          {/* ── OTP ── */}
          {step === "otp" && (
            <form onSubmit={handleOtp} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">Verification code</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                    required value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-800 text-2xl tracking-[0.5em] text-center font-bold placeholder:text-slate-400 placeholder:text-base placeholder:tracking-normal focus-visible:border-primary"
                    placeholder="000000" autoFocus />
                </div>
                <p className="text-xs text-slate-400">Code expires in 10 minutes.</p>
              </div>
              <Button type="submit" className="w-full h-11 text-base font-semibold" isLoading={isLoading}>
                Verify &amp; Sign In
              </Button>
              <button type="button" onClick={() => { setStep("credentials"); setOtpCode(""); setError(""); setInfo(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </form>
          )}

          {/* ── forgot password ── */}
          {step === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">Your email address</Label>
                <EmailInput value={email} onChange={setEmail} placeholder="you@example.com" />
              </div>
              <Button type="submit" className="w-full h-11 text-base font-semibold" isLoading={isLoading || forgotMut.isPending}>
                Send Reset Link
              </Button>
              <button type="button" onClick={() => { setStep("credentials"); setError(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </form>
          )}

          {/* ── forgot done ── */}
          {step === "forgot_done" && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  If <strong className="text-slate-900">{email}</strong> is registered, a password reset link has been sent.
                </p>
                <p className="text-slate-400 text-xs mt-1">Check your inbox and spam folder.</p>
              </div>
              <Button variant="outline" className="w-full h-11"
                onClick={() => { setStep("credentials"); setError(""); setInfo(""); }}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
              </Button>
            </div>
          )}

          {/* ── reset password ── */}
          {step === "reset" && (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">New password</Label>
                <PasswordInput value={newPassword} onChange={setNewPassword} icon={KeyRound} required minLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">Confirm new password</Label>
                <PasswordInput
                  value={confirmPassword} onChange={setConfirmPassword} icon={KeyRound} required minLength={6}
                  className={confirmPassword && confirmPassword !== newPassword ? "border-red-400 focus-visible:border-red-400" : ""}
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base font-semibold" isLoading={isLoading || resetMut.isPending}>
                Set New Password
              </Button>
            </form>
          )}

          {/* ── password expired ── */}
          {step === "password_expired" && (
            <form onSubmit={handleExpiredPasswordChange} className="space-y-5">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>Your password must be changed before you can continue.</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">Current password</Label>
                <PasswordInput value={expiredCurrentPassword} onChange={setExpiredCurrentPassword} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">New password</Label>
                <PasswordInput value={expiredNewPassword} onChange={setExpiredNewPassword} icon={KeyRound} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm font-medium">Confirm new password</Label>
                <PasswordInput
                  value={expiredConfirmPassword} onChange={setExpiredConfirmPassword} icon={KeyRound} required
                  className={expiredConfirmPassword && expiredConfirmPassword !== expiredNewPassword ? "border-red-400" : ""}
                />
              </div>
              <Button type="submit" className="w-full h-11 text-base font-semibold" isLoading={isLoading}>
                Update Password &amp; Sign In
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
