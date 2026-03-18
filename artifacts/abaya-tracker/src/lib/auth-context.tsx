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

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  refetch: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAuthUser(): Promise<{ isAuthenticated: boolean; user?: AppUser }> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/auth/user`, {
    credentials: "include",
  });
  if (!res.ok) return { isAuthenticated: false };
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  async function refetch() {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const data = await fetchAuthUser();
      setState({
        user: data.user ?? null,
        isAuthenticated: data.isAuthenticated,
        isLoading: false,
      });
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
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
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, refetch, logout }}>
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
