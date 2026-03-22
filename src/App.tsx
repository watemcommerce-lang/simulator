import { Switch, Route, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/Navbar";
import Dashboard from "@/Dashboard";
import Simulador from "@/Simulador";
import Resultado from "@/Resultado";
import Historico from "@/Historico";
import Login from "@/Login";
import { Loader2 } from "lucide-react";

export default function App() {
  const { data: session, isLoading } = trpc.auth.me.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center"
        style={{ background: "linear-gradient(135deg, var(--purple-dark), var(--teal))" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!session) {
    return (
      <Switch>
        <Route path="/login"><Login /></Route>
        <Route><Login /></Route>
      </Switch>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Switch>
          <Route path="/"><Dashboard /></Route>
          <Route path="/simulado"><Simulador /></Route>
          <Route path="/resultado/:id">
            {(params) => <Resultado id={Number(params.id)} />}
          </Route>
          <Route path="/historico"><Historico /></Route>
          <Route><Redirect to="/" /></Route>
        </Switch>
      </main>
    </div>
  );
}
