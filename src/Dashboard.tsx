import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  PlayCircle, Trophy, Clock, Target, Loader2,
  BarChart2, BookOpen, Brain, Award, Flame, Zap,
  Timer, CheckCircle2, XCircle, ChevronRight, Medal, Dumbbell
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState } from "react";

const FEATURES = [
  { icon: Timer,    title: "Temporizador inteligente", desc: "Cronômetro por questão que muda de verde para vermelho quando o tempo ideal é excedido." },
  { icon: Target,   title: "Correção pela TRI",        desc: "Sua nota é calculada pela Teoria de Resposta ao Item, simulando a metodologia real do ENEM." },
  { icon: BarChart2,title: "Histórico de evolução",    desc: "Acompanhe suas últimas tentativas e veja sua evolução ao longo do tempo." },
  { icon: Brain,    title: "Banco de questões",        desc: "Questões reais do ENEM cobrindo todos os tópicos de Matemática." },
  { icon: BookOpen, title: "Fórmulas completas",       desc: "Álgebra, Geometria, Trigonometria e mais — todas as fórmulas com explicação." },
  { icon: Award,    title: "Resultados detalhados",    desc: "Veja cada questão com gabarito, sua resposta e análise por tópico." },
];

function DailyCard() {
  const [, navigate] = useLocation();
  const { data: daily, isLoading } = trpc.simulations.getDailyChallenge.useQuery();

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#01738d" }} /></div>;
  if (!daily) return null;

  const questions = daily.questions as any[];
  const answers = daily.answers as Record<string, string>;
  const answered = questions.filter(q => answers[q.id]).length;

  if (daily.completed) {
    const correct = daily.correctCount ?? 0;
    const total = questions.length;
    const color = correct === total ? "#00695C" : correct >= 2 ? "#E65100" : "#C62828";
    const bg = correct === total ? "var(--secondary)" : correct >= 2 ? "#FFF8E1" : "#FFEBEE";
    const border = correct === total ? "#00BFA5" : correct >= 2 ? "#F9A825" : "#E53935";
    return (
      <div className="rounded-2xl p-5 flex items-center justify-between gap-4" style={{ background: bg, border: `1.5px solid ${border}` }}>
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 flex-shrink-0" style={{ color }} />
          <div>
            <p className="font-bold text-sm" style={{ color }}>Desafio concluído hoje!</p>
            <p className="text-xs mt-0.5" style={{ color }}>{correct}/{total} acertos</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {questions.map((q, i) => {
            const ok = answers[q.id] === q.gabarito;
            return (
              <div key={i} className="h-7 w-7 rounded-full flex items-center justify-center"
                style={{ background: ok ? "#00BFA5" : "#E53935" }}>
                {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : <XCircle className="h-3.5 w-3.5 text-white" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => navigate("/desafio")} className="w-full text-left rounded-2xl p-5 transition-all hover:opacity-90"
      style={{ background: "var(--teal-soft)", border: "1.5px solid #01738d44" }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#01738d" }}>
            <Flame className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "#01738d" }}>Desafio do dia</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {answered}/{questions.length} respondidas · Clique para começar
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: "#01738d" }} />
      </div>
      <div className="flex gap-1.5 mt-3">
        {questions.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full"
            style={{ background: answers[questions[i].id] ? "#01738d" : "var(--border)" }} />
        ))}
      </div>
    </button>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: active } = trpc.simulations.getActive.useQuery();
  const { data: stats } = trpc.simulations.getStats.useQuery();
  const { data: questionsData } = trpc.questions.list.useQuery({ page: 1, pageSize: 1, activeOnly: true, orderBy: "id", orderDir: "desc" });
  const totalQuestions = questionsData?.pagination.total ?? 0;

  const startMutation = trpc.simulations.start.useMutation({
    onSuccess: () => navigate("/simulado"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-8 py-2">

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #01738d 0%, #004d61 100%)" }}>
        <div className="px-6 py-8 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(255,255,255,0.15)" }}>
            ENEM Matemática
          </div>
          <h1 className="text-2xl font-bold leading-tight mb-2">Prepare-se para o ENEM com precisão</h1>
          <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.85)", maxWidth: 480 }}>
            Simulados com correção pela Teoria de Resposta ao Item — a mesma metodologia usada pelo INEP.
          </p>
          <div className="flex items-center gap-3 flex-wrap mb-5">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.12)" }}>
              <span className="font-black text-lg">{totalQuestions > 0 ? `${totalQuestions}+` : "—"}</span>
              <span style={{ color: "rgba(255,255,255,0.75)" }}>questões</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.12)" }}>
              <span className="font-black text-lg">TRI</span>
              <span style={{ color: "rgba(255,255,255,0.75)" }}>correção real</span>
            </div>
            {stats && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.12)" }}>
                <Flame className="h-4 w-4" style={{ color: "#FFA726" }} />
                <span className="font-black text-lg">{stats.streak}</span>
                <span style={{ color: "rgba(255,255,255,0.75)" }}>dias streak</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => active ? navigate("/simulado") : startMutation.mutate({ stage: 3 })}
              disabled={startMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "#fff", color: "#01738d" }}>
              {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {active ? "Continuar simulado" : "Iniciar simulado"}
            </button>
            <button onClick={() => navigate("/treino")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
              <Dumbbell className="h-4 w-4" /> Treino livre
            </button>
          </div>
        </div>
      </div>

      {/* Simulado em andamento */}
      {active && (
        <div className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
          style={{ background: "#FFF8E1", border: "1.5px solid #F9A825" }}
          onClick={() => navigate("/simulado")}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: "#F9A825" }}>
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#795548" }}>Simulado em andamento</p>
              <p className="text-xs" style={{ color: "#A1887F" }}>{active.answeredCount}/{active.totalQuestions} respondidas</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4" style={{ color: "#A1887F" }} />
        </div>
      )}

      {/* Desafio diário */}
      <section>
        <h2 className="text-base font-bold mb-3" style={{ color: "var(--foreground)" }}>Desafio diário</h2>
        <DailyCard />
      </section>

      {/* Stats semanais + gráfico */}
      {stats && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm" style={{ color: "var(--foreground)" }}>Semana atual</h2>
              <button onClick={() => navigate("/ranking")} className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#01738d" }}>
                <Medal className="h-3.5 w-3.5" /> Ranking
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                { icon: Zap, label: "Questões respondidas", value: String(stats.weeklyQuestions) },
                { icon: Target, label: "Taxa de acerto", value: `${stats.weeklyAccuracy}%` },
                { icon: Flame, label: "Streak atual", value: `${stats.streak} ${stats.streak === 1 ? "dia" : "dias"}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#E0F7F4" }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: "#01738d" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
                    <p className="font-bold text-sm" style={{ color: "var(--foreground)" }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}>
            <h2 className="font-bold text-sm mb-3" style={{ color: "var(--foreground)" }}>Questões por dia</h2>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={stats.dailyData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [v, "Questões"]} />
                <Bar dataKey="questoes" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {stats.dailyData.map((entry, i) => (
                    <Cell key={i} fill={entry.questoes > 0 ? "#01738d" : "var(--border)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Recursos */}
      <section>
        <h2 className="text-base font-bold mb-1" style={{ color: "var(--foreground)" }}>Recursos da plataforma</h2>
        <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>Tudo o que você precisa para se preparar para o ENEM.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}>
              <div className="h-9 w-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: "#E0F7F4" }}>
                <Icon className="h-4 w-4" style={{ color: "#01738d" }} />
              </div>
              <h3 className="font-bold text-sm mb-1" style={{ color: "var(--foreground)" }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
