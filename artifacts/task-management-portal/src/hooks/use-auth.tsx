import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
  const [_, setLocation] = useLocation();
  const token = localStorage.getItem("access_token");
  
  const { data: user, isLoading, refetch } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const handleLogin = async (data: LoginRequest) => {
    const result = await loginMutation.mutateAsync({ data });
    if (result.access_token) {
      localStorage.setItem("access_token", result.access_token);
      await refetch();
      setLocation("/");
    }
  };

  const handleLogout = async () => {
    try {
      if (token) await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
  };

  const isAuthenticated = !!user;
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  return (
    <AuthContext.Provider value={{
      user: user || null,
      isLoading,
      login: handleLogin,
      logout: handleLogout,
      isAuthenticated,
      isAdminOrManager
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
