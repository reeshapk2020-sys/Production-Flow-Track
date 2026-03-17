import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import DashboardPage from "./pages/dashboard";
import MasterDataPage from "./pages/master";
import FabricRollsPage from "./pages/fabric-rolls";
import CuttingPage from "./pages/cutting";
import AllocationPage from "./pages/allocation";
import ReceivingPage from "./pages/receiving";
import FinishingPage from "./pages/finishing";
import FinishedGoodsPage from "./pages/finished-goods";
import InventoryPage from "./pages/inventory";
import ReportsPage from "./pages/reports";
import TraceabilityPage from "./pages/traceability";
import AuditPage from "./pages/audit";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/master" component={MasterDataPage} />
      <Route path="/fabric-rolls" component={FabricRollsPage} />
      <Route path="/cutting" component={CuttingPage} />
      <Route path="/allocation" component={AllocationPage} />
      <Route path="/receiving" component={ReceivingPage} />
      <Route path="/finishing" component={FinishingPage} />
      <Route path="/finished-goods" component={FinishedGoodsPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/traceability" component={TraceabilityPage} />
      <Route path="/audit" component={AuditPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
