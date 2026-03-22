import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface AppUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  appUserId?: number;
  role: string;
  fullName: string | null;
  username: string | null;
  loginType: "replit" | "staff";
}

export type ModulePerms = { canView: boolean; canCreate: boolean; canEdit: boolean; canImport: boolean };
export type PermissionsMap = Record<string, ModulePerms>;

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: PermissionsMap;
}

interface AuthContextValue extends AuthState {
  refetch: () => void;
  logout: () => Promise<void>;
  can: (module: string, action: "view" | "create" | "edit" | "import") => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAuthUser(): Promise<{ isAuthenticated: boolean; user?: AppUser }> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/auth/user`, {
    credentials: "include",
  });
  if (!res.ok) return { isAuthenticated: false };
  return res.json();
}

async function fetchMyPermissions(): Promise<PermissionsMap> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/permissions/my`, { credentials: "include" });
    if (!res.ok) return {};
    const data = await res.json();
    return data.permissions || {};
  } catch {
    return {};
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    permissions: {},
  });

  async function refetch() {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const data = await fetchAuthUser();
      let perms: PermissionsMap = {};
      if (data.isAuthenticated) {
        perms = await fetchMyPermissions();
      }
      setState({
        user: data.user ?? null,
        isAuthenticated: data.isAuthenticated,
        isLoading: false,
        permissions: perms,
      });
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false, permissions: {} });
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  async function logout() {
    if (state.user?.loginType === "replit") {
      window.location.href = `${import.meta.env.BASE_URL}api/logout`;
    } else {
      await fetch(`${import.meta.env.BASE_URL}api/staff/logout`, {
        method: "POST",
        credentials: "include",
      });
      setState({ user: null, isAuthenticated: false, isLoading: false, permissions: {} });
    }
  }

  function can(module: string, action: "view" | "create" | "edit" | "import"): boolean {
    if (state.user?.role === "admin") return true;
    const p = state.permissions[module];
    if (!p) return false;
    const fieldMap = { view: "canView", create: "canCreate", edit: "canEdit", import: "canImport" } as const;
    return p[fieldMap[action]];
  }

  return (
    <AuthContext.Provider value={{ ...state, refetch, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAppAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAppAuth must be used inside AuthProvider");
  return ctx;
}

export function displayName(user: AppUser | null): string {
  if (!user) return "Unknown";
  return user.fullName || user.firstName || user.username || "User";
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  cutting: "Cutting",
  allocation: "Allocation",
  stitching: "Stitching / Receiving",
  finishing: "Finishing",
  store: "Finished Goods Store",
  reporting: "Reporting",
};
