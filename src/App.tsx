import { Switch, Route, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/Navbar";
import Footer from "@/Footer";
import Dashboard from "@/Dashboard";
import Simulador from "@/Simulador";
import Resultado from "@/Resultado";
import Historico from "@/Historico";
import Questoes from "@/Questoes";
import AdminQuestoes from "@/AdminQuestoes";
import AdminUsuarios from "@/AdminUsuarios";
import Treino from "@/Treino";
import Ranking from "@/Ranking";
import Formulas from "@/Formulas";
import Login from "@/Login";
import { Loader2, AlertTriangle } from "lucide-react";

// Aviso de assinatura expirada ou sem assinatura
function SubscriptionBanner({ session }: { session: any }) {
  if (session.role === "admin") return null;

  const now = new Date();
  const expiry = session.subscriptionExpiresAt ? new Date(session.subscriptionExpiresAt) : null;

  if (expiry && expiry < now) {
    return (
      <div className="w-full px-4 py-3 text-center text-sm font-semibold flex items-center justify-center gap-2"
        style={{ background: "#FFEBEE", color: "#C62828", borderBottom: "1px solid #FFCDD2" }}>
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        Sua assinatura expirou em {expiry.toLocaleDateString("pt-BR")}. Entre em contato com o administrador para renovar.
      </div>
    );
  }

  if (expiry) {
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) {
      return (
        <div className="w-full px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2"
          style={{ background: "#FFF8E1", color: "#E65100", borderBottom: "1px solid #FFE082" }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Sua assinatura expira em {days} {days === 1 ? "dia" : "dias"} ({expiry.toLocaleDateString("pt-BR")}).
        </div>
      );
    }
  }

  return null;
}

export default function App() {
  const { data: session, isLoading } = trpc.auth.me.useQuery();

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#01738d" }}>
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );

  if (!session) return (
    <Switch>
      <Route path="/login"><Login /></Route>
      <Route><Login /></Route>
    </Switch>
  );

  const isAdmin = session.role === "admin";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f4f4f4" }}>
      <Navbar />
      <SubscriptionBanner session={session} />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Switch>
          <Route path="/"><Dashboard /></Route>
          <Route path="/simulado"><Simulador /></Route>
          <Route path="/questoes"><Questoes /></Route>
          <Route path="/resultado/:id">
            {(params) => <Resultado id={Number(params.id)} />}
          </Route>
          <Route path="/historico"><Historico /></Route>
          <Route path="/treino"><Treino /></Route>
          <Route path="/ranking"><Ranking /></Route>
          <Route path="/formulas"><Formulas /></Route>
          <Route path="/admin/questoes">
            {isAdmin ? <AdminQuestoes /> : <Redirect to="/" />}
          </Route>
          <Route path="/admin/usuarios">
            {isAdmin ? <AdminUsuarios /> : <Redirect to="/" />}
          </Route>
          <Route><Redirect to="/" /></Route>
        </Switch>
      </main>
      <Footer />
    </div>
  );
}
