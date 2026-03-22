import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, BarChart2 } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();

  const login = trpc.auth.login.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const isPending = login.isPending || register.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "login") {
      login.mutate({ email, password });
    } else {
      if (name.trim().length < 2) { toast.error("Nome deve ter pelo menos 2 caracteres."); return; }
      register.mutate({ name, email, password });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.85rem",
    borderRadius: "0.75rem",
    border: "2px solid var(--border)",
    fontSize: "0.9rem",
    outline: "none",
    color: "var(--foreground)",
    background: "var(--background)",
    transition: "border-color 0.15s",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, var(--purple-dark) 0%, var(--purple) 60%, var(--teal) 100%)" }}>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-3"
            style={{ background: "rgba(255,255,255,0.15)" }}>
            <BarChart2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Simulador ENEM</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>
            Matemática com correção TRI
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          {/* Tabs */}
          <div className="flex mb-5 rounded-xl overflow-hidden" style={{ background: "var(--muted)" }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2 text-sm font-semibold transition-colors rounded-xl"
                style={mode === m
                  ? { background: "var(--purple)", color: "#fff" }
                  : { background: "transparent", color: "var(--muted-foreground)" }}>
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>
                  Nome
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="O teu nome" required style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--purple)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="teu@email.com" required style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--purple)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>
                Senha
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" required minLength={6} style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--purple)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
            </div>

            <button type="submit" disabled={isPending}
              className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, var(--purple), var(--teal))", opacity: isPending ? 0.6 : 1 }}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
