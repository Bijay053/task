import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

const BASE_ROLES = ["admin", "manager", "team_leader", "agent"];

export interface RolePerm {
  department: string;
  can_view: boolean;
  can_edit: boolean;
  can_upload: boolean;
  can_delete: boolean;
}

interface PermissionContextValue {
  perms: RolePerm[];
  isCustomRole: boolean;
  canView: (dept: string) => boolean;
  canEdit: (dept: string) => boolean;
  canDelete: (dept: string) => boolean;
  canUpload: (dept: string) => boolean;
}

const PermissionContext = createContext<PermissionContextValue>({
  perms: [],
  isCustomRole: false,
  canView: () => true,
  canEdit: () => true,
  canDelete: () => true,
  canUpload: () => true,
});

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [perms, setPerms] = useState<RolePerm[]>([]);

  const isCustomRole = !!user && !BASE_ROLES.includes(user.role);

  useEffect(() => {
    if (!user || !isCustomRole) {
      setPerms([]);
      return;
    }
    const token = localStorage.getItem("access_token");
    fetch("/api/permissions/my", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setPerms)
      .catch(() => setPerms([]));
  }, [user?.role]);

  const getPerm = (dept: string): RolePerm | undefined =>
    perms.find(p => p.department === dept);

  const canView = (dept: string) => {
    if (!isCustomRole) return true;
    const p = getPerm(dept);
    return p ? p.can_view : false;
  };
  const canEdit = (dept: string) => {
    if (!isCustomRole) return true;
    const p = getPerm(dept);
    return p ? p.can_edit : false;
  };
  const canDelete = (dept: string) => {
    if (!isCustomRole) return true;
    const p = getPerm(dept);
    return p ? p.can_delete : false;
  };
  const canUpload = (dept: string) => {
    if (!isCustomRole) return true;
    const p = getPerm(dept);
    return p ? p.can_upload : false;
  };

  return (
    <PermissionContext.Provider value={{ perms, isCustomRole, canView, canEdit, canDelete, canUpload }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
