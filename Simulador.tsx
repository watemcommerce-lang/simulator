import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { QuestionCard } from "@/components/LatexRenderer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, ChevronLeft, ChevronRight, CheckSquare, Loader2 } from "lucide-react";

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
    active.questions.forEach((q) => { if (q.selectedAnswer) saved[q.id] = q.selectedAnswer; });
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
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (!active) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-muted-foreground">Nenhum simulado em andamento.</p>
      <button onClick={() => navigate("/")} className="px-4 py-2 rounded-lg bg-foreground text-background text-sm hover:opacity-80">
        Voltar ao início
      </button>
    </div>
  );

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
    const missing = questions.filter((q) => !answers[q.id]).length;
    if (missing > 0 && !confirm(`${missing} questão(ões) sem resposta. Confirmas?`)) return;
    await finish.mutateAsync({ simulationId: active.simulationId, totalTimeSeconds: totalRef.current });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Etapa {active.stage}</span>
          <div className="h-1.5 w-28 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${(answered / active.totalQuestions) * 100}%` }} />
          </div>
          <span className="text-sm text-muted-foreground">{answered}/{active.totalQuestions}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-mono font-medium",
            overTime ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}>
            <Clock className="h-3.5 w-3.5" />{fmt(qTime)}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{fmt(totalTime)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
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
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>

        <button onClick={() => setShowGrid((v) => !v)}
          className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted tabular-nums">
          {idx + 1} / {questions.length}
        </button>

        {idx < questions.length - 1 ? (
          <button onClick={() => setIdx((i) => i + 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleFinish} disabled={finish.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-80 disabled:opacity-50">
            {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
            Finalizar
          </button>
        )}
      </div>

      {showGrid && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => { setIdx(i); setShowGrid(false); }}
                className={cn("h-8 rounded-md text-xs font-medium transition-colors",
                  i === idx ? "ring-2 ring-primary bg-primary/10"
                  : answers[q.id] ? "bg-primary/80 text-primary-foreground hover:bg-primary"
                  : "bg-muted border border-border hover:bg-muted/80"
                )}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={handleFinish} disabled={finish.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-80 disabled:opacity-50">
              {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
              Finalizar simulado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
