import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { QuestionCard } from "@/LatexRenderer";
import { Loader2, BookOpen, ChevronRight, ChevronLeft, RotateCcw, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type TrainingQuestion = {
  id: number;
  enunciado: string;
  url_imagem: string | null;
  alternativas: Record<string, string>;
  gabarito: string;
  comentario_resolucao: string | null;
  conteudo_principal: string;
  nivel_dificuldade: string;
};

export default function Treino() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<TrainingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [idx, setIdx] = useState(0);
  const [finished, setFinished] = useState(false);

  const { data: topics, isLoading: loadingTopics } = trpc.simulations.getTopics.useQuery();
  const startTraining = trpc.simulations.startFreeTraining.useMutation({
    onSuccess: (data) => {
      setQuestions(data.questions as TrainingQuestion[]);
      setAnswers({});
      setRevealed({});
      setIdx(0);
      setFinished(false);
    },
  });

  function handleAnswer(questionId: number, alt: string) {
    if (revealed[questionId]) return;
    setAnswers((p) => ({ ...p, [questionId]: alt }));
    setRevealed((p) => ({ ...p, [questionId]: true }));
  }

  function handleStart() {
    startTraining.mutate({ conteudo: selectedTopic ?? undefined, count });
  }

  function handleReset() {
    setQuestions([]);
    setAnswers({});
    setRevealed({});
    setIdx(0);
    setFinished(false);
  }

  // Tela de seleção
  if (questions.length === 0) {
    return (
      <div className="space-y-8 py-2">
        <div className="rounded-2xl px-6 py-8 text-white" style={{ background: "linear-gradient(135deg, #7B3FA0, #4A235A)" }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-semibold opacity-80">Treino livre</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">Pratique sem pressão</h1>
          <p className="text-sm opacity-80">Escolha um tópico, responda e veja o gabarito na hora.</p>
        </div>

        {loadingTopics ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7B3FA0" }} /></div>
        ) : (
          <div className="space-y-5">
            {/* Tópico */}
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: "#1A1A2E" }}>Tópico</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    border: `1.5px solid ${selectedTopic === null ? "#7B3FA0" : "#E2D9EE"}`,
                    background: selectedTopic === null ? "#F3EAF9" : "#fff",
                    color: selectedTopic === null ? "#7B3FA0" : "#64748B",
                  }}
                >
                  Todos os tópicos
                </button>
                {topics?.map((t) => (
                  <button
                    key={t.conteudo}
                    onClick={() => setSelectedTopic(t.conteudo)}
                    className="text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
                    style={{
                      border: `1.5px solid ${selectedTopic === t.conteudo ? "#7B3FA0" : "#E2D9EE"}`,
                      background: selectedTopic === t.conteudo ? "#F3EAF9" : "#fff",
                      color: selectedTopic === t.conteudo ? "#7B3FA0" : "#64748B",
                    }}
                  >
                    <span className="block">{t.conteudo}</span>
                    <span className="text-xs opacity-60">{Number(t.total)} questões</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantidade */}
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: "#1A1A2E" }}>Quantidade</p>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{
                      border: `1.5px solid ${count === n ? "#7B3FA0" : "#E2D9EE"}`,
                      background: count === n ? "#F3EAF9" : "#fff",
                      color: count === n ? "#7B3FA0" : "#64748B",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={startTraining.isPending}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold"
              style={{ background: "#7B3FA0" }}
            >
              {startTraining.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <BookOpen className="h-4 w-4" />}
              Começar treino
            </button>
          </div>
        )}
      </div>
    );
  }

  // Tela de resultado final
  if (finished) {
    const correct = questions.filter((q) => answers[q.id] === q.gabarito).length;
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <div className="space-y-6 py-2">
        <div className="rounded-2xl p-6 text-center" style={{ background: pct >= 70 ? "#E0F7F4" : "#FFEBEE", border: `1.5px solid ${pct >= 70 ? "#00BFA5" : "#E53935"}` }}>
          <p className="text-4xl font-black mb-1" style={{ color: pct >= 70 ? "#00695C" : "#C62828" }}>{pct}%</p>
          <p className="text-sm font-medium" style={{ color: pct >= 70 ? "#00695C" : "#C62828" }}>
            {correct} de {questions.length} acertos
          </p>
          <p className="text-xs mt-1 opacity-70" style={{ color: pct >= 70 ? "#00695C" : "#C62828" }}>
            {pct >= 70 ? "Ótimo desempenho!" : pct >= 50 ? "Continue praticando!" : "Revise o conteúdo e tente novamente."}
          </p>
        </div>

        {/* Resumo por questão */}
        <div className="space-y-2">
          {questions.map((q, i) => {
            const isCorrect = answers[q.id] === q.gabarito;
            return (
              <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: isCorrect ? "#E0F7F4" : "#FFEBEE", border: `1px solid ${isCorrect ? "#00BFA544" : "#E5393544"}` }}>
                <span className="text-xs font-bold w-5 text-center" style={{ color: isCorrect ? "#00695C" : "#C62828" }}>{i + 1}</span>
                <span className="flex-1 text-xs truncate" style={{ color: "#64748B" }}>{q.conteudo_principal}</span>
                <span className="text-xs font-bold" style={{ color: isCorrect ? "#00695C" : "#C62828" }}>
                  {answers[q.id] ?? "—"} → {q.gabarito}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white" style={{ background: "#7B3FA0" }}>
            <RotateCcw className="h-4 w-4" /> Novo treino
          </button>
        </div>
      </div>
    );
  }

  // Tela de questão
  const q = questions[idx];
  const isRevealed = revealed[q.id];

  return (
    <div className="space-y-5 py-2">
      {/* Header */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: "#F3EAF9", border: "1.5px solid #7B3FA044" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: "#7B3FA0" }}>Treino livre</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#7B3FA022", color: "#7B3FA0" }}>{q.nivel_dificuldade}</span>
        </div>
        <span className="text-sm font-mono" style={{ color: "#64748B" }}>{idx + 1}/{questions.length}</span>
      </div>

      {/* Questão */}
      <div className="card">
        <QuestionCard
          order={idx + 1}
          total={questions.length}
          enunciado={q.enunciado}
          url_imagem={q.url_imagem}
          alternativas={q.alternativas}
          selectedAnswer={answers[q.id] ?? null}
          correctAnswer={isRevealed ? q.gabarito : null}
          onAnswer={(alt) => handleAnswer(q.id, alt)}
          disabled={isRevealed}
        />
      </div>

      {/* Resolução */}
      {isRevealed && q.comentario_resolucao && (
        <div className="rounded-xl p-4" style={{ background: "#F3EAF9", border: "1px solid #7B3FA022" }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "#7B3FA0" }}>Resolução</p>
          <p className="text-sm" style={{ color: "#4A235A" }}>{q.comentario_resolucao}</p>
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="btn-outline flex items-center gap-1" style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>

        <span className="text-sm font-semibold tabular-nums px-3 py-2 rounded-xl" style={{ background: "#F1F5F9", color: "#1A1A2E" }}>
          {idx + 1} / {questions.length}
        </span>

        {idx < questions.length - 1 ? (
          <button onClick={() => setIdx((i) => i + 1)} className="btn-outline flex items-center gap-1" style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}>
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => setFinished(true)} className="btn-primary flex items-center gap-1">
            <CheckSquare className="h-4 w-4" /> Ver resultado
          </button>
        )}
      </div>
    </div>
  );
}
