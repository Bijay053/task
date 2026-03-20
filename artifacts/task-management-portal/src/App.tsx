import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import GsApplications from "@/pages/applications";
import OfferApplications from "@/pages/offer-applications";
import Reports from "@/pages/reports";
import MyTasks from "@/pages/my-tasks";
import Approved from "@/pages/approved";
import Students from "@/pages/students";
import Universities from "@/pages/universities";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import Agents from "@/pages/agents";

setAuthTokenGetter(() => localStorage.getItem("access_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function ProtectedRoute({ component: Component, ...rest }: { component: any, [key: string]: any }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/applications">
        {() => <ProtectedRoute component={GsApplications} />}
      </Route>
      <Route path="/offer-applications">
        {() => <ProtectedRoute component={OfferApplications} />}
      </Route>
      <Route path="/my-tasks">
        {() => <ProtectedRoute component={MyTasks} />}
      </Route>
      <Route path="/approved">
        {() => <ProtectedRoute component={Approved} />}
      </Route>
      <Route path="/students">
        {() => <ProtectedRoute component={Students} />}
      </Route>
      <Route path="/universities">
        {() => <ProtectedRoute component={Universities} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={Users} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/agents">
        {() => <ProtectedRoute component={Agents} />}
      </Route>
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
