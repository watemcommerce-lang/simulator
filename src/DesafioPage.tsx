import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { QuestionCard } from "@/LatexRenderer";
import { Loader2, CheckCircle2, XCircle, Flame, ChevronLeft, ChevronRight } from "lucide-react";

type DailyQ = {
  id: number;
  enunciado: string;
  url_imagem: string | null;
  alternativas: Record<string, string>;
  gabarito: string;
  comentario_resolucao: string | null;
  conteudo_principal: string;
  nivel_dificuldade: string;
};

export default function DesafioPage() {
  const [, navigate] = useLocation();
  const { data: daily, isLoading, refetch } = trpc.simulations.getDailyChallenge.useQuery();
  const saveDailyAnswer = trpc.simulations.saveDailyAnswer.useMutation();
  const finishDaily = trpc.simulations.finishDailyChallenge.useMutation({
    onSuccess: () => refetch(),
  });

  const [localAnswers, setLocalAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [idx, setIdx] = useState(0);

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
    </div>
  );
  if (!daily) return null;

  const questions = daily.questions as DailyQ[];
  const answers = { ...(daily.answers as Record<string, string>), ...localAnswers };
  const allAnswered = questions.every((q) => answers[q.id]);

  if (daily.completed) {
    const correct = daily.correctCount ?? 0;
    const total = questions.length;
    const color = correct === total ? "#00695C" : correct >= 2 ? "#E65100" : "#C62828";
    const bg = correct === total ? "var(--secondary)" : correct >= 2 ? "#FFF8E1" : "#FFEBEE";
    const border = correct === total ? "#00BFA5" : correct >= 2 ? "#F9A825" : "#E53935";

    return (
      <div className="space-y-6 py-2">
        <div className="rounded-2xl p-6 text-center" style={{ background: bg, border: `1.5px solid ${border}` }}>
          <Flame className="h-10 w-10 mx-auto mb-3" style={{ color }} />
          <p className="text-3xl font-black mb-1" style={{ color }}>{correct}/{total}</p>
          <p className="font-semibold" style={{ color }}>
            {correct === total ? "Perfeito! Acertou tudo!" : correct >= 2 ? "Bom desempenho!" : "Continue praticando!"}
          </p>
        </div>

        <div className="space-y-2">
          {questions.map((q, i) => {
            const isCorrect = answers[q.id] === q.gabarito;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: isCorrect ? "var(--secondary)" : "#FFEBEE", border: `1px solid ${isCorrect ? "#00BFA544" : "#E5393544"}` }}>
                {isCorrect
                  ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "#00695C" }} />
                  : <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: "#C62828" }} />}
                <span className="flex-1 text-sm truncate" style={{ color: "var(--muted-foreground)" }}>{q.conteudo_principal}</span>
                <span className="text-xs font-bold" style={{ color: isCorrect ? "#00695C" : "#C62828" }}>
                  {answers[q.id] ?? "—"} → {q.gabarito}
                </span>
              </div>
            );
          })}
        </div>

        <button onClick={() => navigate("/")} className="btn-primary w-full justify-center">
          Voltar ao início
        </button>
      </div>
    );
  }

  const q = questions[idx];
  const isRevealed = revealed[q.id];

  async function handleAnswer(alt: string) {
    if (revealed[q.id]) return;
    setLocalAnswers((p) => ({ ...p, [q.id]: alt }));
    setRevealed((p) => ({ ...p, [q.id]: true }));
    await saveDailyAnswer.mutateAsync({ challengeId: daily!.challengeId, questionId: q.id, selectedAnswer: alt });
  }

  return (
    <div className="space-y-5 py-2">
      <div className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={{ background: "var(--teal-soft)", border: "1.5px solid #01738d44" }}>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4" style={{ color: "#E65100" }} />
          <span className="font-bold text-sm" style={{ color: "#01738d" }}>Desafio do dia</span>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className="h-2 rounded-full transition-all"
              style={{ width: idx === i ? 20 : 8, background: answers[questions[i].id] ? "#01738d" : "var(--border)" }} />
          ))}
        </div>
      </div>

      <div className="card">
        <QuestionCard
          order={idx + 1}
          total={questions.length}
          enunciado={q.enunciado}
          url_imagem={q.url_imagem}
          alternativas={q.alternativas}
          selectedAnswer={localAnswers[q.id] ?? (daily.answers as Record<string,string>)[q.id] ?? null}
          correctAnswer={isRevealed ? q.gabarito : null}
          onAnswer={handleAnswer}
          disabled={isRevealed}
        />
      </div>

      {isRevealed && q.comentario_resolucao && (
        <div className="rounded-xl p-4" style={{ background: "var(--teal-soft)", border: "1px solid #01738d22" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "#01738d" }}>Resolução</p>
          <p className="text-sm" style={{ color: "var(--foreground)" }}>{q.comentario_resolucao}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="btn-outline flex items-center gap-1" style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <span className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>{idx + 1}/{questions.length}</span>
        {idx < questions.length - 1 ? (
          <button onClick={() => setIdx(idx + 1)} className="btn-outline flex items-center gap-1"
            style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}>
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        ) : allAnswered ? (
          <button onClick={() => finishDaily.mutateAsync({ challengeId: daily.challengeId })}
            disabled={finishDaily.isPending}
            className="btn-primary flex items-center gap-1">
            {finishDaily.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Ver resultado
          </button>
        ) : (
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Responda todas</span>
        )}
      </div>
    </div>
  );
}
