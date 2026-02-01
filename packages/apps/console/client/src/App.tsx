import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Dashboard from "@/pages/dashboard";
import OperationsHub from "@/pages/operations-hub";
import WorkbenchPage from "@/pages/workbench-page";
import OpsConsole, { SignalDetailPage } from "@/pages/ops-console";
import ServiceCatalog, { ServiceDetailPage } from "@/pages/service-catalog";
import { WorkflowListPage, WorkflowDetailPage } from "@/pages/workflows";
import { PageLayout } from "@/components/page-layout";

// Placeholder for future lazy loading if needed
// const WorkflowListPage = lazy(() => import("@golden/workflows").then(m => ({ default: m.WorkflowListPage })));

import NotFound from "@/pages/not-found";

function Router() {
  return (
    <PageLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/operations" component={OperationsHub} />
        <Route path="/workbench" component={WorkbenchPage} />
        {/* Kept for backward compat or signal view if needed, though 'Console' tab is gone */}
        <Route path="/console" component={OpsConsole} />
        <Route path="/console/signal/:id" component={SignalDetailPage} />
        <Route path="/services" component={ServiceCatalog} />
        <Route path="/services/:id" component={ServiceDetailPage} />
        <Route path="/workflows" component={WorkflowListPage} />
        <Route path="/workflows/:id" component={WorkflowDetailPage} />
        <Route component={NotFound} />
      </Switch>
    </PageLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
