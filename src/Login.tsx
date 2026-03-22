import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e) => toast.error(e.message),
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: (e) => toast.error(e.message),
  });

  const isPending = login.isPending || register.isPending;

  function handleSubmit() {
    if (mode === "login") {
      if (!email || !password) { toast.error("Preencha todos os campos."); return; }
      login.mutate({ email, password });
    } else {
      if (name.trim().length < 2) { toast.error("O nome deve ter pelo menos 2 caracteres."); return; }
      if (!email) { toast.error("Preencha o e-mail."); return; }
      if (password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres."); return; }
      register.mutate({ name, email, password });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.85rem",
    borderRadius: "0.75rem",
    border: "2px solid #D1D5DB",
    fontSize: "0.9rem",
    outline: "none",
    color: "#1E293B",
    background: "#FFFFFF",
    transition: "border-color 0.15s",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#f4f4f4" }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo-vetor.png"
            alt="Vetor"
            className="h-24 w-24 object-contain mx-auto mb-3"
          />
          <h1 className="text-2xl font-black tracking-wide" style={{ color: "#01738d" }}>VETOR</h1>
          <p className="text-sm" style={{ color: "#64748B" }}>Escola de Talentos · Simulador ENEM</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{ background: "#FFFFFF", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden" style={{ background: "#F1F5F9" }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2.5 text-sm font-bold transition-colors rounded-xl"
                style={mode === m
                  ? { background: "#01738d", color: "#fff" }
                  : { background: "transparent", color: "#64748B" }}>
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
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome" style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                  onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1E293B" }}>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1E293B" }}>Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            </div>
          </div>

          {/* Botão */}
          <button onClick={handleSubmit} disabled={isPending}
            className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2"
            style={{ background: isPending ? "#5BAFC0" : "#01738d", color: "#fff", border: "none", cursor: isPending ? "not-allowed" : "pointer" }}>
            {isPending && <Loader2 className="h-5 w-5 animate-spin" />}
            {mode === "login" ? "Entrar na conta" : "Criar minha conta"}
          </button>

          {/* Link alternativo */}
          <p className="text-center text-sm" style={{ color: "#64748B" }}>
            {mode === "login" ? (
              <>Não possui conta?{" "}
                <button onClick={() => setMode("register")} className="font-bold underline underline-offset-2" style={{ color: "#01738d" }}>
                  Cadastre-se
                </button>
              </>
            ) : (
              <>Já possui conta?{" "}
                <button onClick={() => setMode("login")} className="font-bold underline underline-offset-2" style={{ color: "#01738d" }}>
                  Faça login
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#94A3B8" }}>
          © {new Date().getFullYear()} Escola Vetor · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
