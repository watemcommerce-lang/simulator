import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Lock, CheckCircle2, PlayCircle, Trophy, Clock,
  Target, ChevronRight, Loader2, Timer, BarChart2,
  BookOpen, Brain, Award, Flame, Zap, Medal
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const STAGES = [
  { label: "Etapa 1", desc: "15 questões · mínimo 12 acertos", time: "5 min por questão", color: "#01738d", soft: "#E0F7F4" },
  { label: "Etapa 2", desc: "25 questões · mínimo 18 acertos", time: "4 min por questão", color: "#7B3FA0", soft: "#F3EAF9" },
  { label: "Etapa 3", desc: "45 questões · avaliação TRI",    time: "3 min por questão", color: "#E65100", soft: "#FFF3E0" },
];

const FEATURES = [
  { icon: Timer,    title: "Temporizador Inteligente", desc: "Cronômetro por questão que muda de verde para vermelho quando o tempo ideal é excedido." },
  { icon: Target,   title: "Correção pela TRI",        desc: "Na Etapa 3, sua nota é calculada pela Teoria de Resposta ao Item, simulando a metodologia real do ENEM." },
  { icon: BarChart2,title: "Histórico de Evolução",    desc: "Acompanhe suas últimas tentativas em cada etapa e veja sua evolução ao longo do tempo." },
  { icon: Brain,    title: "Banco de Questões",        desc: "Questões reais do ENEM cobrindo todos os tópicos de Matemática, organizadas por conteúdo." },
  { icon: BookOpen, title: "Questões Formato ENEM",    desc: "Simulados com o mesmo nível de dificuldade e formato das provas oficiais do ENEM." },
  { icon: Award,    title: "Resultados Detalhados",    desc: "Veja cada questão com gabarito, sua resposta, tempo gasto e análise por tópico." },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: progress, isLoading } = trpc.simulations.getProgress.useQuery();
  const { data: active } = trpc.simulations.getActive.useQuery();
  const { data: stats } = trpc.simulations.getStats.useQuery();

  const { data: questionsData } = trpc.questions.list.useQuery({
    page: 1, pageSize: 1, activeOnly: true, orderBy: "id", orderDir: "desc",
  });
  const totalQuestions = questionsData?.pagination.total ?? 0;

  const startMutation = trpc.simulations.start.useMutation({
    onSuccess: () => navigate("/simulado"),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
    </div>
  );

  return (
    <div className="space-y-10 py-2">

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #01738d 0%, #004d61 100%)" }}>
        <div className="px-6 py-10 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(255,255,255,0.15)" }}>
            ENEM Matemática
          </div>
          <h1 className="text-3xl font-bold leading-tight mb-3">
            Prepare-se para o<br />ENEM com precisão
          </h1>
          <p className="text-base mb-6" style={{ color: "rgba(255,255,255,0.85)", maxWidth: 480 }}>
            Simulados progressivos com correção pela Teoria de Resposta ao Item — a mesma metodologia usada pelo INEP.
          </p>
          <div className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl mb-6" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div className="text-center">
              <p className="text-2xl font-black">{totalQuestions > 0 ? `${totalQuestions}+` : "—"}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>questões</p>
            </div>
            <div className="w-px h-10 bg-white opacity-20" />
            <div className="text-center">
              <p className="text-2xl font-black">3</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>etapas</p>
            </div>
            <div className="w-px h-10 bg-white opacity-20" />
            <div className="text-center">
              <p className="text-2xl font-black">TRI</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>correção real</p>
            </div>
            {stats && (
              <>
                <div className="w-px h-10 bg-white opacity-20" />
                <div className="text-center">
                  <p className="text-2xl font-black flex items-center gap-1 justify-center">
                    <Flame className="h-5 w-5" style={{ color: "#FFA726" }} />
                    {stats.streak}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>dias streak</p>
                </div>
              </>
            )}
          </div>
          <div>
            <button
              onClick={() => navigate("/simulado")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: "#fff", color: "#01738d" }}
            >
              <PlayCircle className="h-5 w-5" />
              Começar agora
            </button>
          </div>
        </div>
      </div>

      {/* Metas semanais + gráfico */}
      {stats && (
        <section className="grid gap-4 sm:grid-cols-2">
          {/* Cards de meta */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "#fff", border: "1.5px solid #E2D9EE" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm" style={{ color: "#1A1A2E" }}>Semana atual</h2>
              <button
                onClick={() => navigate("/ranking")}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "#01738d" }}
              >
                <Medal className="h-3.5 w-3.5" /> Ranking
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#E0F7F4" }}>
                  <Zap className="h-4 w-4" style={{ color: "#01738d" }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs" style={{ color: "#64748B" }}>Questões respondidas</p>
                  <p className="font-bold text-sm" style={{ color: "#1A1A2E" }}>{stats.weeklyQuestions}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#E0F7F4" }}>
                  <Target className="h-4 w-4" style={{ color: "#01738d" }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs" style={{ color: "#64748B" }}>Taxa de acerto</p>
                  <p className="font-bold text-sm" style={{ color: "#1A1A2E" }}>{stats.weeklyAccuracy}%</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FFF8E1" }}>
                  <Flame className="h-4 w-4" style={{ color: "#E65100" }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs" style={{ color: "#64748B" }}>Streak atual</p>
                  <p className="font-bold text-sm" style={{ color: "#1A1A2E" }}>{stats.streak} {stats.streak === 1 ? "dia" : "dias"} consecutivos</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate("/treino")}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: "#01738d" }}
            >
              <Brain className="h-4 w-4" /> Treino livre
            </button>
          </div>

          {/* Gráfico diário */}
          <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1.5px solid #E2D9EE" }}>
            <h2 className="font-bold text-sm mb-4" style={{ color: "#1A1A2E" }}>Questões por dia</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.dailyData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E2D9EE", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [v, name === "questoes" ? "Questões" : "Acertos"]}
                />
                <Bar dataKey="questoes" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {stats.dailyData.map((entry, i) => (
                    <Cell key={i} fill={entry.questoes > 0 ? "#01738d" : "#E2D9EE"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Simulado em andamento */}
      {active && (
        <div
          className="flex items-center justify-between p-4 rounded-xl cursor-pointer"
          style={{ background: "#FFF8E1", border: "1.5px solid #F9A825" }}
          onClick={() => navigate("/simulado")}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: "#F9A825" }}>
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#795548" }}>Simulado em andamento</p>
              <p className="text-xs" style={{ color: "#A1887F" }}>
                Etapa {active.stage} · {active.answeredCount}/{active.totalQuestions} respondidas
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4" style={{ color: "#A1887F" }} />
        </div>
      )}

      {/* Etapas */}
      <section>
        <h2 className="text-lg font-bold mb-4" style={{ color: "#1A1A2E" }}>Suas etapas</h2>
        <div className="grid gap-3">
          {progress?.map((stage, idx) => {
            const meta = STAGES[idx];
            const isLocked = !stage.unlocked;
            const isPassed = stage.passed;

            return (
              <div key={stage.stage} className="rounded-xl p-5 transition-all"
                style={{
                  border: `1.5px solid ${isLocked ? "#E2D9EE" : meta.color + "55"}`,
                  background: isLocked ? "#F8FAFC" : meta.soft,
                  opacity: isLocked ? 0.65 : 1,
                }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: isLocked ? "#E2D9EE" : meta.color }}>
                      {isLocked ? <Lock className="h-4 w-4 text-white" />
                        : isPassed ? <CheckCircle2 className="h-4 w-4 text-white" />
                        : <Target className="h-4 w-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-bold" style={{ color: "#1A1A2E" }}>{meta.label}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={isLocked
                            ? { background: "#E2D9EE", color: "#94A3B8" }
                            : isPassed
                            ? { background: meta.color + "22", color: meta.color }
                            : { background: meta.color + "22", color: meta.color }}>
                          {isLocked ? "Bloqueada" : isPassed ? "Concluída ✓" : "Disponível"}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: "#64748B" }}>{meta.desc}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>⏱ {meta.time}</p>
                      {stage.bestCorrectCount !== null && (
                        <div className="flex items-center gap-4 mt-3">
                          <Stat label="Melhor resultado" value={`${stage.bestCorrectCount}/${stage.totalQuestions}`} />
                          {stage.bestScore !== null && (
                            <Stat label={stage.stage === 3 ? "Nota TRI" : "Pontuação"} value={stage.stage === 3 ? String(Math.round(stage.bestScore)) : `${stage.bestScore}%`} />
                          )}
                          <Stat label="Tentativas" value={String(stage.attempts)} />
                        </div>
                      )}
                      {stage.recentAttempts.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-3">
                          <span className="text-xs mr-1" style={{ color: "#94A3B8" }}>Últimas:</span>
                          {stage.recentAttempts.map((a: any, i: number) => (
                            <div key={i} className="h-2 w-6 rounded-full"
                              style={{ background: (a.correctCount ?? 0) >= stage.minPassRequired ? "#00BFA5" : "#E53935" }}
                              title={`${a.correctCount}/${a.totalQuestions}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {!isLocked && (
                    <button
                      onClick={() => active ? navigate("/simulado") : startMutation.mutate({ stage: stage.stage as 1 | 2 | 3 })}
                      disabled={startMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-sm flex-shrink-0"
                      style={{ background: meta.color }}>
                      {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      {active ? "Continuar" : "Iniciar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recursos da plataforma */}
      <section>
        <h2 className="text-lg font-bold mb-1" style={{ color: "#1A1A2E" }}>Recursos da plataforma</h2>
        <p className="text-sm mb-5" style={{ color: "#64748B" }}>Tudo o que você precisa para se preparar para o ENEM.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl p-5" style={{ background: "#fff", border: "1.5px solid #E2D9EE" }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#E0F7F4" }}>
                <Icon className="h-5 w-5" style={{ color: "#01738d" }} />
              </div>
              <h3 className="font-bold text-sm mb-1.5" style={{ color: "#1A1A2E" }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Troféu */}
      {progress?.find((s) => s.stage === 3 && s.passed) && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "#E0F7F4", border: "1.5px solid #01738d" }}>
          <Trophy className="h-5 w-5 flex-shrink-0" style={{ color: "#01738d" }} />
          <p className="text-sm font-medium" style={{ color: "#01738d" }}>
            Parabéns! Você completou todas as etapas.{" "}
            <button onClick={() => navigate("/historico")} className="underline underline-offset-2 font-bold">
              Ver histórico
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
