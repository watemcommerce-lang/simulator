import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { QuestionCard } from "@/LatexRenderer";
import { toast } from "sonner";
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

  if (!active) {
    return (
      <div className="space-y-6 py-2">
        <div className="rounded-2xl px-6 py-8 text-white" style={{ background: "linear-gradient(135deg, #01738d, #004d61)" }}>
          <h1 className="text-2xl font-bold mb-2">Simulado ENEM</h1>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.85)" }}>
            45 questões de Matemática com correção pela Teoria de Resposta ao Item — a mesma metodologia usada pelo INEP.
          </p>
          <div className="flex items-center gap-3 flex-wrap mb-6">
            {[
              { label: "45", sub: "questões" },
              { label: "TRI", sub: "correção real" },
              { label: "3 min", sub: "por questão" },
            ].map(({ label, sub }) => (
              <div key={label} className="px-4 py-2.5 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.12)" }}>
                <span className="font-black text-lg block">{label}</span>
                <span style={{ color: "rgba(255,255,255,0.75)" }}>{sub}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => start.mutate({ stage: 3 })}
            disabled={start.isPending}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: "#fff", color: "#01738d" }}
          >
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Iniciar simulado
          </button>
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
      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: "var(--teal-soft)", border: "1.5px solid #01738d44" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: "#01738d" }}>Simulado</span>
          <div className="progress-bar w-28 hidden sm:block">
            <div className="progress-bar-fill" style={{ width: `${(answered / active.totalQuestions) * 100}%` }} />
          </div>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{answered}/{active.totalQuestions}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`timer ${overTime ? "warn" : "ok"}`}>
            <Clock className="h-3.5 w-3.5" />
            {fmt(qTime)}
          </div>
          <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>Total {fmt(totalTime)}</span>
        </div>
      </div>

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

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
          className="btn-outline flex items-center gap-1" style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button onClick={() => setShowGrid((v) => !v)}
          className="text-sm font-semibold tabular-nums px-3 py-2 rounded-xl"
          style={{ background: "var(--muted)", color: "var(--foreground)" }}>
          {idx + 1} / {questions.length}
        </button>
        {idx < questions.length - 1 ? (
          <button onClick={() => setIdx((i) => i + 1)} className="btn-outline flex items-center gap-1"
            style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}>
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleFinish} disabled={finish.isPending} className="btn-primary">
            {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
            Finalizar
          </button>
        )}
      </div>

      {showGrid && (
        <div className="card space-y-3">
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((q: any, i: number) => (
              <button key={q.id} onClick={() => { setIdx(i); setShowGrid(false); }}
                className="h-8 rounded-lg text-xs font-bold transition-colors"
                style={i === idx
                  ? { background: "var(--teal-soft)", border: "2px solid #01738d", color: "#01738d" }
                  : answers[q.id]
                  ? { background: "#01738d", color: "#fff", border: "2px solid transparent" }
                  : { background: "var(--muted)", color: "var(--muted-foreground)", border: "2px solid var(--border)" }}>
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
