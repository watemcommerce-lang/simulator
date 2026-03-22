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

  function handleSubmit() {
    if (mode === "login") {
      if (!email || !password) { toast.error("Preenche todos os campos."); return; }
      login.mutate({ email, password });
    } else {
      if (name.trim().length < 2) { toast.error("Nome deve ter pelo menos 2 caracteres."); return; }
      if (!email) { toast.error("Preenche o email."); return; }
      if (password.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres."); return; }
      register.mutate({ name, email, password });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.85rem",
    borderRadius: "0.75rem",
    border: "2px solid #CBD5E1",
    fontSize: "0.9rem",
    outline: "none",
    color: "#1E293B",
    background: "#F8FAFC",
    transition: "border-color 0.15s",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #1E3A5F 0%, #1D4ED8 60%, #0EA5E9 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-3"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <BarChart2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Simulador ENEM</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
            Matemática com correção TRI
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden" style={{ background: "#F1F5F9" }}>
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2.5 text-sm font-bold transition-colors rounded-xl"
                style={
                  mode === m
                    ? { background: "#1D4ED8", color: "#FFFFFF" }
                    : { background: "transparent", color: "#64748B" }
                }
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {/* Campos */}
          <div className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1E293B" }}>
                  Nome completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="O teu nome"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#1D4ED8")}
                  onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1E293B" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teu@email.com"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#1D4ED8")}
                onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1E293B" }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#1D4ED8")}
                onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          </div>

          {/* Botão principal — azul escuro, bem destacado */}
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2"
            style={{
              background: isPending ? "#93C5FD" : "#1D4ED8",
              color: "#FFFFFF",
              fontSize: "1rem",
              cursor: isPending ? "not-allowed" : "pointer",
              border: "none",
              letterSpacing: "0.01em",
            }}
          >
            {isPending && <Loader2 className="h-5 w-5 animate-spin" />}
            {mode === "login" ? "Entrar na conta" : "Criar minha conta"}
          </button>

          {/* Link alternativo */}
          <p className="text-center text-sm" style={{ color: "#64748B" }}>
            {mode === "login" ? (
              <>
                Possui conta?{" "}
                <button
                  onClick={() => setMode("register")}
                  className="font-bold underline underline-offset-2"
                  style={{ color: "#1D4ED8" }}
                >
                  Criar conta grátis
                </button>
              </>
            ) : (
              <>
                Possui conta?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="font-bold underline underline-offset-2"
                  style={{ color: "#1D4ED8" }}
                >
                  Fazer login
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
