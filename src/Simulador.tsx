import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { QuestionCard } from "@/LatexRenderer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, ChevronLeft, ChevronRight, CheckSquare, Loader2, PlayCircle } from "lucide-react";

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Simulador() {
  const [, navigate] = useLocation();
  const { data: active, isLoading } = trpc.simulations.getActive.useQuery();
  const saveAnswer = trpc.simulations.saveAnswer.useMutation();
  const finish = trpc.simulations.finish.useMutation({
    onSuccess: (d) => navigate(`/resultado/${d.simulationId}`),
    onError: (e) => toast.error(e.message),
  });
  const start = trpc.simulations.start.useMutation({
    onSuccess: () => { window.location.reload(); },
    onError: (e) => toast.error(e.message),
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [qTime, setQTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const qTimeRef = useRef(0);
  const totalRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const saved: Record<number, string> = {};
    active.questions.forEach((q: any) => { if (q.selectedAnswer) saved[q.id] = q.selectedAnswer; });
    setAnswers(saved);
  }, [active]);

  useEffect(() => {
    const t = setInterval(() => {
      qTimeRef.current++;
      totalRef.current++;
      setQTime(qTimeRef.current);
      setTotalTime(totalRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { qTimeRef.current = 0; setQTime(0); }, [idx]);

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
    </div>
  );

  // Sem simulado em andamento — mostra tela de início
  if (!active) {
    const stageProgress = progress ?? [];
    return (
      <div className="space-y-6 py-2">
        <div className="rounded-2xl px-6 py-6 text-white" style={{ background: "linear-gradient(135deg, #01738d, #00BFA5)" }}>
          <h1 className="text-xl font-bold">Iniciar Simulado</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
            Escolha a etapa para começar
          </p>
        </div>

        <div className="grid gap-3">
          {([1, 2, 3] as const).map((stage) => {
            const s = stageProgress.find((p: any) => p.stage === stage);
            const unlocked = s?.unlocked ?? stage === 1;
            const passed = s?.passed ?? false;

            return (
              <div
                key={stage}
                className="rounded-xl p-5 flex items-center justify-between gap-4"
                style={{
                  border: `1.5px solid ${unlocked ? "#01738d44" : "#E2D9EE"}`,
                  background: unlocked ? "#E0F7F4" : "#F8FAFC",
                  opacity: unlocked ? 1 : 0.6,
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold" style={{ color: "#1A1A2E" }}>Etapa {stage}</p>
                    {passed && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#01738d", color: "#fff" }}>Concluída</span>}
                    {!unlocked && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#E2D9EE", color: "#64748B" }}>Bloqueada</span>}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
                    {stage === 1 ? "15 questões · mínimo 12 acertos" : stage === 2 ? "25 questões · mínimo 18 acertos" : "45 questões · avaliação TRI"}
                  </p>
                  {s?.bestCorrectCount != null && (
                    <p className="text-xs mt-1" style={{ color: "#01738d" }}>
                      Melhor: {s.bestCorrectCount}/{s.totalQuestions} acertos
                    </p>
                  )}
                </div>
                {unlocked && (
                  <button
                    onClick={() => start.mutate({ stage })}
                    disabled={start.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm flex-shrink-0"
                    style={{ background: "#01738d" }}
                  >
                    {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                    Iniciar
                  </button>
                )}
              </div>
            );
          })}
        </div>


      </div>
    );
  }

  const questions = active.questions;
  const q = questions[idx];
  const overTime = qTime > active.timeLimitPerQuestion;
  const answered = Object.keys(answers).length;

  async function handleAnswer(questionId: number, alt: string) {
    setAnswers((p) => ({ ...p, [questionId]: alt }));
    await saveAnswer.mutateAsync({
      simulationId: active!.simulationId,
      questionId,
      selectedAnswer: alt,
      timeSpentSeconds: qTimeRef.current,
    });
  }

  async function handleFinish() {
    const missing = questions.filter((q: any) => !answers[q.id]).length;
    if (missing > 0 && !confirm(`${missing} questão(ões) sem resposta. Deseja finalizar mesmo assim?`)) return;
    await finish.mutateAsync({ simulationId: active.simulationId, totalTimeSeconds: totalRef.current });
  }

  return (
    <div className="space-y-5 py-2">
      {/* Barra de topo */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: "#E0F7F4", border: "1.5px solid #01738d44" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: "#01738d" }}>Etapa {active.stage}</span>
          <div className="progress-bar w-28 hidden sm:block">
            <div className="progress-bar-fill" style={{ width: `${(answered / active.totalQuestions) * 100}%` }} />
          </div>
          <span className="text-sm" style={{ color: "#64748B" }}>{answered}/{active.totalQuestions}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`timer ${overTime ? "warn" : "ok"}`}>
            <Clock className="h-3.5 w-3.5" />
            {fmt(qTime)}
          </div>
          <span className="text-xs font-mono" style={{ color: "#64748B" }}>Total {fmt(totalTime)}</span>
        </div>
      </div>

      {/* Questão */}
      <div className="card">
        <QuestionCard
          order={idx + 1}
          total={questions.length}
          enunciado={q.enunciado}
          url_imagem={q.url_imagem}
          alternativas={q.alternativas as Record<string, string>}
          selectedAnswer={answers[q.id] ?? null}
          correctAnswer={null}
          onAnswer={(alt) => handleAnswer(q.id, alt)}
        />
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="btn-outline flex items-center gap-1"
          style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>

        <button
          onClick={() => setShowGrid((v) => !v)}
          className="text-sm font-semibold tabular-nums px-3 py-2 rounded-xl"
          style={{ background: "#F1F5F9", color: "#1A1A2E" }}
        >
          {idx + 1} / {questions.length}
        </button>

        {idx < questions.length - 1 ? (
          <button
            onClick={() => setIdx((i) => i + 1)}
            className="btn-outline flex items-center gap-1"
            style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={finish.isPending}
            className="btn-primary"
          >
            {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
            Finalizar
          </button>
        )}
      </div>

      {/* Grid */}
      {showGrid && (
        <div className="card space-y-3">
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((q: any, i: number) => (
              <button
                key={q.id}
                onClick={() => { setIdx(i); setShowGrid(false); }}
                className="h-8 rounded-lg text-xs font-bold transition-colors"
                style={
                  i === idx
                    ? { background: "#E0F7F4", border: "2px solid #01738d", color: "#01738d" }
                    : answers[q.id]
                    ? { background: "#01738d", color: "#fff", border: "2px solid transparent" }
                    : { background: "#F1F5F9", color: "#64748B", border: "2px solid #E2D9EE" }
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={handleFinish} disabled={finish.isPending} className="btn-primary">
              {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
              Finalizar simulado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
