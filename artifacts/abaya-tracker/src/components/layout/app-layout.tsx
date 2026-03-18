import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAppAuth, displayName, ROLE_LABELS } from "@/lib/auth-context";
import {
  LayoutDashboard, Database, Layers, Scissors, Send,
  Inbox, Settings2, Package, Box, BarChart3,
  GitBranch, Shield, Users, LogOut, Loader2, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["all"] },
  { path: "/fabric-rolls", label: "Fabric Rolls", icon: Layers, roles: ["admin", "cutting"] },
  { path: "/cutting", label: "Cutting", icon: Scissors, roles: ["admin", "cutting"] },
  { path: "/allocation", label: "Allocation", icon: Send, roles: ["admin", "allocation"] },
  { path: "/receiving", label: "Receiving", icon: Inbox, roles: ["admin", "stitching"] },
  { path: "/finishing", label: "Finishing", icon: Settings2, roles: ["admin", "finishing"] },
  { path: "/finished-goods", label: "Finished Goods", icon: Package, roles: ["admin", "store"] },
  { path: "/inventory", label: "Inventory", icon: Box, roles: ["admin", "store", "reporting"] },
  { path: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "reporting"] },
  { path: "/traceability", label: "Traceability", icon: GitBranch, roles: ["all"] },
  { path: "/master", label: "Master Data", icon: Database, roles: ["admin"] },
  { path: "/users", label: "User Management", icon: Users, roles: ["admin"] },
  { path: "/audit", label: "Audit Log", icon: Shield, roles: ["admin"] },
];

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const [location] = useLocation();
  const { user, isLoading, logout } = useAppAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const userRole = user?.role || "reporting";
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => item.roles.includes("all") || item.roles.includes(userRole),
  );

  const userDisplay = displayName(user);
  const initials = userDisplay.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 shadow-2xl z-20 hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <Package className="h-6 w-6 text-primary mr-3" />
          <span className="font-display font-bold text-lg text-white tracking-wide">AbayaTracker</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Main Menu
          </div>
          {visibleNavItems.map((item) => {
            const isActive =
              location === item.path ||
              (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-primary text-white shadow-md shadow-primary/20 font-medium"
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon
                  className={`h-5 w-5 mr-3 transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:text-primary"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center mb-4 gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0">
              {initials || "U"}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-white truncate">{userDisplay}</p>
              <p className="text-xs text-slate-400">
                @{user?.username} · <span className="capitalize">{ROLE_LABELS[user?.role ?? ""] || user?.role}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center px-6 lg:px-8 shrink-0 z-10">
          <h1 className="text-2xl font-display font-semibold text-slate-800 flex-1">{title}</h1>
          {/* Mobile user info */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
              {initials || "U"}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
