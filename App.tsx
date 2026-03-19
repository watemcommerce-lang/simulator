import { Switch, Route, Redirect } from "wouter";
import { trpc } from "./lib/trpc";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Simulador from "./pages/Simulador";
import Resultado from "./pages/Resultado";
import Historico from "./pages/Historico";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminQuestoes from "./pages/admin/AdminQuestoes";
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

  if (!session) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && session.role !== "admin") {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Switch>
          {/* Rotas públicas */}
          <Route path="/login">
            <LoginRedirect />
          </Route>

          {/* Aluno */}
          <Route path="/">
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </Route>

          <Route path="/simulado">
            <ProtectedRoute>
              <Simulador />
            </ProtectedRoute>
          </Route>

          <Route path="/resultado/:id">
            {(params) => (
              <ProtectedRoute>
                <Resultado id={Number(params.id)} />
              </ProtectedRoute>
            )}
          </Route>

          <Route path="/historico">
            <ProtectedRoute>
              <Historico />
            </ProtectedRoute>
          </Route>

          {/* Admin */}
          <Route path="/admin">
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/questoes">
            <ProtectedRoute adminOnly>
              <AdminQuestoes />
            </ProtectedRoute>
          </Route>

          {/* 404 */}
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </main>
    </div>
  );
}

function LoginRedirect() {
  // O OAuth do Manus redireciona automaticamente — este componente
  // serve apenas como fallback visual enquanto o redirect acontece
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
