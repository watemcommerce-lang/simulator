import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  PlayCircle, Trophy, Clock, Target, Loader2,
  BarChart2, BookOpen, Brain, Award, Flame, Zap,
  Timer, CheckCircle2, XCircle, ChevronRight, Medal, Dumbbell
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { QuestionCard } from "@/LatexRenderer";
import { useState } from "react";

const FEATURES = [
  { icon: Timer,    title: "Temporizador inteligente", desc: "Cronômetro por questão que muda de verde para vermelho quando o tempo ideal é excedido." },
  { icon: Target,   title: "Correção pela TRI",        desc: "Sua nota é calculada pela Teoria de Resposta ao Item, simulando a metodologia real do ENEM." },
  { icon: BarChart2,title: "Histórico de evolução",    desc: "Acompanhe suas últimas tentativas e veja sua evolução ao longo do tempo." },
  { icon: Brain,    title: "Banco de questões",        desc: "Questões reais do ENEM cobrindo todos os tópicos de Matemática." },
  { icon: BookOpen, title: "Fórmulas completas",       desc: "Álgebra, Geometria, Trigonometria e mais — todas as fórmulas com explicação." },
  { icon: Award,    title: "Resultados detalhados",    desc: "Veja cada questão com gabarito, sua resposta e análise por tópico." },
];

type DailyQuestion = {
  id: number;
  enunciado: string;
  url_imagem: string | null;
  alternativas: Record<string, string>;
  gabarito: string;
  comentario_resolucao: string | null;
  conteudo_principal: string;
  nivel_dificuldade: string;
};

function DailyChallenge() {
  const { data: daily, isLoading, refetch } = trpc.simulations.getDailyChallenge.useQuery();
  const saveDailyAnswer = trpc.simulations.saveDailyAnswer.useMutation();
  const finishDaily = trpc.simulations.finishDailyChallenge.useMutation({
    onSuccess: () => refetch(),
  });

  const [localAnswers, setLocalAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [currentIdx, setCurrentIdx] = useState(0);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#01738d" }} /></div>;
  if (!daily) return null;

  const questions = daily.questions as DailyQuestion[];
  const answers = { ...daily.answers, ...localAnswers };
  const allAnswered = questions.every((q) => answers[q.id]);

  if (daily.completed) {
    const correct = daily.correctCount ?? 0;
    const total = questions.length;
    return (
      <div className="rounded-2xl p-5" style={{ background: correct === total ? "#E0F7F4" : correct >= 2 ? "#FFF8E1" : "#FFEBEE", border: `1.5px solid ${correct === total ? "#00BFA5" : correct >= 2 ? "#F9A825" : "#E53935"}` }}>
        <div className="flex items-center gap-3 mb-3">
          <Trophy className="h-5 w-5" style={{ color: correct === total ? "#00695C" : correct >= 2 ? "#E65100" : "#C62828" }} />
          <p className="font-bold" style={{ color: correct === total ? "#00695C" : correct >= 2 ? "#E65100" : "#C62828" }}>
            Desafio de hoje concluído! {correct}/{total} acertos
          </p>
        </div>
        <div className="flex gap-2">
          {questions.map((q, i) => {
            const isCorrect = answers[q.id] === q.gabarito;
            return (
              <div key={i} className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ background: isCorrect ? "#00BFA5" : "#E53935" }}>
                {isCorrect
                  ? <CheckCircle2 className="h-4 w-4 text-white" />
                  : <XCircle className="h-4 w-4 text-white" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;

  const isRevealed = revealed[q.id];

  async function handleAnswer(alt: string) {
    if (revealed[q.id]) return;
    setLocalAnswers((p) => ({ ...p, [q.id]: alt }));
    setRevealed((p) => ({ ...p, [q.id]: true }));
    await saveDailyAnswer.mutateAsync({ challengeId: daily!.challengeId, questionId: q.id, selectedAnswer: alt });
  }

  async function handleFinish() {
    await finishDaily.mutateAsync({ challengeId: daily!.challengeId });
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid #01738d44" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#E0F7F4" }}>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4" style={{ color: "#E65100" }} />
          <span className="font-bold text-sm" style={{ color: "#01738d" }}>Desafio do dia</span>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)}
              className="h-2 rounded-full transition-all"
              style={{ width: currentIdx === i ? 20 : 8, background: answers[questions[i].id] ? "#01738d" : "#B2DFDB" }} />
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4" style={{ background: "var(--card)" }}>
        <QuestionCard
          order={currentIdx + 1}
          total={questions.length}
          enunciado={q.enunciado}
          url_imagem={q.url_imagem}
          alternativas={q.alternativas}
          selectedAnswer={localAnswers[q.id] ?? (daily.answers as Record<string,string>)[q.id] ?? null}
          correctAnswer={isRevealed ? q.gabarito : null}
          onAnswer={handleAnswer}
          disabled={isRevealed}
        />

        {isRevealed && q.comentario_resolucao && (
          <div className="rounded-xl p-3" style={{ background: "#E0F7F4", border: "1px solid #01738d22" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#01738d" }}>Resolução</p>
            <p className="text-sm" style={{ color: "#004d61" }}>{q.comentario_resolucao}</p>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
            className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
            Anterior
          </button>
          {currentIdx < questions.length - 1 ? (
            <button onClick={() => setCurrentIdx(currentIdx + 1)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#01738d" }}>
              Próxima
            </button>
          ) : allAnswered ? (
            <button onClick={handleFinish} disabled={finishDaily.isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-1"
              style={{ background: "#01738d" }}>
              {finishDaily.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Ver resultado
            </button>
          ) : null}
        </div>
      </div>
    </div>
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
        <DailyChallenge />
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
