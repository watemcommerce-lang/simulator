import { Switch, Route, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/Navbar";
import Dashboard from "@/Dashboard";
import Simulador from "@/Simulador";
import Resultado from "@/Resultado";
import Historico from "@/Historico";
import { Loader2 } from "lucide-react";

function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { data: session, isLoading } = trpc.auth.me.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <Redirect to="/login" />;
  if (adminOnly && session.role !== "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Switch>
        <Route path="/login">
          <AuthPage /> 
        </Route>

          <Route path="/">
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          </Route>

          <Route path="/simulado">
            <ProtectedRoute><Simulador /></ProtectedRoute>
          </Route>

          <Route path="/resultado/:id">
            {(params) => (
              <ProtectedRoute>
                <Resultado id={Number(params.id)} />
              </ProtectedRoute>
            )}
          </Route>

          <Route path="/historico">
            <ProtectedRoute><Historico /></ProtectedRoute>
          </Route>

          <Route><Redirect to="/" /></Route>
        </Switch>
      </main>
    </div>
  );
}
