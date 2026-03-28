import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Target, Timer, BarChart2, Brain, BookOpen, Award, Flame } from "lucide-react";

const FEATURES = [
  { icon: Target,   title: "Correção pela TRI",        desc: "Nota calculada pela Teoria de Resposta ao Item — metodologia real do INEP." },
  { icon: Timer,    title: "Temporizador inteligente",  desc: "Cronômetro por questão com alerta visual quando o tempo ideal é excedido." },
  { icon: Flame,    title: "Desafio diário",            desc: "3 questões todo dia para manter o ritmo e acompanhar seu progresso." },
  { icon: Brain,    title: "Treino livre",              desc: "Pratique por tópico com gabarito e resolução imediatos." },
  { icon: BookOpen, title: "Fórmulas completas",        desc: "Álgebra, Geometria, Trigonometria e mais — organizadas e explicadas." },
  { icon: BarChart2,title: "Histórico de evolução",     desc: "Veja sua evolução e identifique onde precisa melhorar." },
  { icon: Award,    title: "Ranking",                   desc: "Compare sua nota TRI com outros alunos e acompanhe seu crescimento." },
];

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
      if (name.trim().length < 2) { toast.error("Nome com pelo menos 2 caracteres."); return; }
      if (!email) { toast.error("Preencha o e-mail."); return; }
      if (password.length < 6) { toast.error("Senha com pelo menos 6 caracteres."); return; }
      register.mutate({ name, email, password });
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#f4f4f4" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #01738d 0%, #004d61 100%)" }}>
        <div className="container mx-auto px-4 max-w-5xl py-12 flex flex-col lg:flex-row items-center gap-10">

          {/* Left: branding + features */}
          <div className="flex-1 text-white">
            <div className="flex items-center gap-3 mb-6">
              <img src="/logo-vetor.png" alt="Vetor" className="h-14 w-14 object-contain"
                style={{ filter: "brightness(0) invert(1)" }} />
              <div>
                <p className="font-black text-2xl leading-none tracking-wider">VETOR</p>
                <p className="text-sm opacity-70">Escola de Talentos · Simulador ENEM</p>
              </div>
            </div>
            <h1 className="text-3xl font-black leading-tight mb-3">
              Prepare-se para o ENEM<br />com precisão real
            </h1>
            <p className="text-base mb-6 opacity-85 max-w-md">
              Simulados com correção pela Teoria de Resposta ao Item — a mesma metodologia usada pelo INEP. Questões reais, resultado real.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { value: "TRI", label: "correção real" },
                { value: "ENEM", label: "questões reais" },
                { value: "0%", label: "chute detectado" },
              ].map(({ value, label }) => (
                <div key={value} className="px-4 py-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                  <p className="font-black text-xl">{value}</p>
                  <p className="text-xs opacity-75">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: login card */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="rounded-2xl p-6 space-y-4" style={{ background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
              <div className="flex rounded-xl overflow-hidden" style={{ background: "#F1F5F9" }}>
                {(["login", "register"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className="flex-1 py-2.5 text-sm font-bold transition-colors rounded-xl"
                    style={mode === m ? { background: "#01738d", color: "#fff" } : { background: "transparent", color: "#64748B" }}>
                    {m === "login" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {mode === "register" && (
                  <div>
                    <label className="block text-sm font-semibold mb-1" style={{ color: "#1E293B" }}>Nome completo</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome" style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                      onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: "#1E293B" }}>E-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com" style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                    onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: "#1E293B" }}>Senha</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                    onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                </div>
              </div>

              <button onClick={handleSubmit} disabled={isPending}
                className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2"
                style={{ background: isPending ? "#5BAFC0" : "#01738d", color: "#fff", border: "none", cursor: isPending ? "not-allowed" : "pointer" }}>
                {isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                {mode === "login" ? "Entrar na conta" : "Criar minha conta"}
              </button>

              <p className="text-center text-sm" style={{ color: "#64748B" }}>
                {mode === "login" ? (
                  <>Não possui conta?{" "}
                    <button onClick={() => setMode("register")} className="font-bold underline" style={{ color: "#01738d" }}>Cadastre-se</button>
                  </>
                ) : (
                  <>Já possui conta?{" "}
                    <button onClick={() => setMode("login")} className="font-bold underline" style={{ color: "#01738d" }}>Faça login</button>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="container mx-auto px-4 max-w-5xl py-12">
        <h2 className="text-xl font-bold mb-2" style={{ color: "#1A1A2E" }}>Tudo que você precisa para o ENEM</h2>
        <p className="text-sm mb-6" style={{ color: "#64748B" }}>Uma plataforma completa, focada em resultado.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl p-5" style={{ background: "#fff", border: "1.5px solid #E2D9EE" }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#E0F7F4" }}>
                <Icon className="h-5 w-5" style={{ color: "#01738d" }} />
              </div>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#1A1A2E" }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs mt-10" style={{ color: "#94A3B8" }}>
          © {new Date().getFullYear()} Escola Vetor · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
