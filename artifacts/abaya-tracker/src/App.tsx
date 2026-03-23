import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import { AuthProvider, useAppAuth } from "@/lib/auth-context";

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
import InventoryPage from "./pages/inventory";
import ReportsPage from "./pages/reports";
import TraceabilityPage from "./pages/traceability";
import AuditPage from "./pages/audit";
import UsersPage from "./pages/users";
import PermissionsPage from "./pages/permissions";
import PurchaseOrdersPage from "./pages/purchase-orders";
import OrdersPage from "./pages/orders";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const PATH_TO_MODULE: Record<string, string> = {
  "/fabric-rolls": "fabric-rolls",
  "/cutting": "cutting",
  "/allocation": "allocation",
  "/outsource": "outsource",
  "/receiving": "receiving",
  "/finishing": "finishing",
  "/finished-goods": "finished-goods",
  "/inventory": "inventory",
  "/reports": "reports",
  "/traceability": "reports",
  "/purchase-orders": "purchase-orders",
  "/orders": "orders",
  "/master": "__admin__",
  "/users": "__admin__",
  "/permissions": "__admin__",
  "/audit": "__admin__",
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
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
      <Route path="/inventory" component={() => <ProtectedRoute component={InventoryPage} path="/inventory" />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} path="/reports" />} />
      <Route path="/traceability" component={() => <ProtectedRoute component={TraceabilityPage} path="/traceability" />} />
      <Route path="/purchase-orders" component={() => <ProtectedRoute component={PurchaseOrdersPage} path="/purchase-orders" />} />
      <Route path="/orders" component={() => <ProtectedRoute component={OrdersPage} path="/orders" />} />
      <Route path="/master" component={() => <ProtectedRoute component={MasterDataPage} path="/master" />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} path="/users" />} />
      <Route path="/permissions" component={() => <ProtectedRoute component={PermissionsPage} path="/permissions" />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} path="/audit" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
