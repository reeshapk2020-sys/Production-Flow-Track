import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import { AuthProvider, useAppAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { setTimeSettings, setOffDays, type WorkSlot } from "@/lib/utils";

import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import MasterDataPage from "./pages/master";
import FabricRollsPage from "./pages/fabric-rolls";
import CuttingPage from "./pages/cutting";
import AllocationPage from "./pages/allocation";
import OutsourcePage from "./pages/outsource";
import ReceivingPage from "./pages/receiving";
import FinishingPage from "./pages/finishing";
import FinishedGoodsPage from "./pages/finished-goods";
import OpeningFinishedGoodsPage from "./pages/opening-finished-goods";
import InventoryPage from "./pages/inventory";
import ReportsPage from "./pages/reports";
import TraceabilityPage from "./pages/traceability";
import AuditPage from "./pages/audit";
import UsersPage from "./pages/users";
import PermissionsPage from "./pages/permissions";
import PurchaseOrdersPage from "./pages/purchase-orders";
import OrdersPage from "./pages/orders";
import DispatchPage from "./pages/dispatch";
import TimeSettingsPage from "./pages/time-settings";
import OffDaysPage from "./pages/off-days";
import ManualPausePage from "./pages/manual-pause";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function TimeSettingsLoader({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`${API_BASE}/time-settings`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((s) => {
        if (s && s.slot1Start !== undefined) {
          const slots: WorkSlot[] = [
            { start: s.slot1Start, end: s.slot1End },
            { start: s.slot2Start, end: s.slot2End, effective: s.slot2Effective || undefined },
            { start: s.slot3Start, end: s.slot3End },
          ];
          setTimeSettings(slots, s.minutesPerPoint || 20);
        }
      })
      .catch(() => {});
    fetch(`${API_BASE}/off-days`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((rows: any[]) => {
        const weeklyDays = rows.filter((r: any) => r.type === "weekly").map((r: any) => r.dayOfWeek as number);
        const holidays = rows.filter((r: any) => r.type === "holiday" && r.date).map((r: any) => r.date as string);
        setOffDays(weeklyDays, holidays);
      })
      .catch(() => {});
  }, [isAuthenticated]);
  return <>{children}</>;
}

const PATH_TO_MODULE: Record<string, string> = {
  "/fabric-rolls": "fabric-rolls",
  "/cutting": "cutting",
  "/allocation": "allocation",
  "/manual-pause": "receiving",
  "/outsource": "outsource",
  "/receiving": "receiving",
  "/finishing": "finishing",
  "/finished-goods": "finished-goods",
  "/opening-finished-goods": "opening-finished-goods",
  "/inventory": "inventory",
  "/reports": "reports",
  "/traceability": "reports",
  "/purchase-orders": "purchase-orders",
  "/orders": "orders",
  "/dispatch": "dispatch",
  "/master": "master-data",
  "/users": "__admin__",
  "/permissions": "__admin__",
  "/audit": "__admin__",
  "/time-settings": "__admin__",
  "/off-days": "__admin__",
};

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType; path: string }) {
  const { user, isAuthenticated, isLoading, can } = useAppAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;

  const module = PATH_TO_MODULE[path];
  if (module === "__admin__" && user?.role !== "admin") return <Redirect to="/" />;
  if (module && module !== "__admin__" && !can(module, "view")) return <Redirect to="/" />;

  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAppAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/" component={() => <ProtectedRoute component={DashboardPage} path="/" />} />
      <Route path="/fabric-rolls" component={() => <ProtectedRoute component={FabricRollsPage} path="/fabric-rolls" />} />
      <Route path="/cutting" component={() => <ProtectedRoute component={CuttingPage} path="/cutting" />} />
      <Route path="/allocation" component={() => <ProtectedRoute component={AllocationPage} path="/allocation" />} />
      <Route path="/outsource" component={() => <ProtectedRoute component={OutsourcePage} path="/outsource" />} />
      <Route path="/receiving" component={() => <ProtectedRoute component={ReceivingPage} path="/receiving" />} />
      <Route path="/finishing" component={() => <ProtectedRoute component={FinishingPage} path="/finishing" />} />
      <Route path="/finished-goods" component={() => <ProtectedRoute component={FinishedGoodsPage} path="/finished-goods" />} />
      <Route path="/opening-finished-goods" component={() => <ProtectedRoute component={OpeningFinishedGoodsPage} path="/opening-finished-goods" />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={InventoryPage} path="/inventory" />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} path="/reports" />} />
      <Route path="/traceability" component={() => <ProtectedRoute component={TraceabilityPage} path="/traceability" />} />
      <Route path="/purchase-orders" component={() => <ProtectedRoute component={PurchaseOrdersPage} path="/purchase-orders" />} />
      <Route path="/orders" component={() => <ProtectedRoute component={OrdersPage} path="/orders" />} />
      <Route path="/dispatch" component={() => <ProtectedRoute component={DispatchPage} path="/dispatch" />} />
      <Route path="/master" component={() => <ProtectedRoute component={MasterDataPage} path="/master" />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} path="/users" />} />
      <Route path="/permissions" component={() => <ProtectedRoute component={PermissionsPage} path="/permissions" />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} path="/audit" />} />
      <Route path="/time-settings" component={() => <ProtectedRoute component={TimeSettingsPage} path="/time-settings" />} />
      <Route path="/off-days" component={() => <ProtectedRoute component={OffDaysPage} path="/off-days" />} />
      <Route path="/manual-pause" component={() => <ProtectedRoute component={ManualPausePage} path="/manual-pause" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <TimeSettingsLoader>
                <Router />
              </TimeSettingsLoader>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
