import { createContext, useContext, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogin, useLogout } from "@workspace/api-client-react";
import type { UserOut, LoginRequest } from "@workspace/api-client-react/src/generated/api.schemas";

interface AuthContextType {
  user: UserOut | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdminOrManager: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();

  // useState so token changes trigger re-renders (re-enables the useGetMe query)
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem("access_token"));

  const { data: user, isLoading } = useGetMe({
    query: {
      enabled: hasToken,
      retry: false,
    },
  });

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const handleLogin = async (data: LoginRequest) => {
    const result = await loginMutation.mutateAsync({ data });
    if (result.access_token) {
      localStorage.setItem("access_token", result.access_token);
      // Enable the useGetMe query, then navigate — ProtectedRoute shows Loading
      // while the /me fetch completes, then renders the page.
      setHasToken(true);
      setLocation("/");
    }
  };

  const handleLogout = () => {
    try { logoutMutation.mutate(); } catch {}
    localStorage.removeItem("access_token");
    setHasToken(false);
    window.location.href = "/login";
  };

  const isAuthenticated = !!user && hasToken;
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading: hasToken && isLoading,
        login: handleLogin,
        logout: handleLogout,
        isAuthenticated,
        isAdminOrManager,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
