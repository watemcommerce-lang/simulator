import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { LatexRenderer } from "./LatexRenderer";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2, RefreshCw, Trophy } from "lucide-react";

const DIFFICULTY_ORDER = ["Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"];

function fmt(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function Resultado({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.simulations.getResult.useQuery({ simulationId: id });
  const [open, setOpen] = useState<number | null>(null);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Resultado não encontrado.</div>;

  const accuracy = Math.round((data.correctCount / data.totalQuestions) * 100);
  const passed = data.stageResult.passed;

  return (
    <div className="space-y-7">
      {/* Resultado principal */}
      <div className={cn("rounded-2xl p-5 border", passed ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30")}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold flex items-center gap-2">
              {passed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}
              Etapa {data.stage} — {passed ? "Aprovado" : "Não aprovado"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{data.stageResult.message}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">
              {data.stage === 3 && data.enemScore != null ? data.enemScore : `${accuracy}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.stage === 3 ? "Pontos ENEM (TRI)" : `${data.correctCount}/${data.totalQuestions} acertos`}
            </p>
          </div>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Acertos", value: `${data.correctCount}/${data.totalQuestions}` },
          { label: "Precisão", value: `${accuracy}%` },
          { label: "Tempo total", value: fmt(data.totalTimeSeconds ?? null) },
          ...(data.triTheta != null ? [{ label: "θ (TRI)", value: data.triTheta.toFixed(2) }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Por dificuldade */}
      {Object.keys(data.byDifficulty).length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Por dificuldade</h2>
          <div className="space-y-2">
            {DIFFICULTY_ORDER.filter((d) => data.byDifficulty[d]).map((diff) => {
              const { correct, total } = data.byDifficulty[diff];
              const pct = Math.round((correct / total) * 100);
              return (
                <div key={diff} className="flex items-center gap-3">
                  <span className="text-xs w-20 text-muted-foreground flex-shrink-0">{diff}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500")}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">{correct}/{total} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Por tópico */}
      {Object.keys(data.byTopic).length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Por tópico</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(data.byTopic).sort(([, a], [, b]) => b.total - a.total).map(([topic, { correct, total }]) => {
              const pct = Math.round((correct / total) * 100);
              return (
                <div key={topic} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card">
                  <p className="text-sm truncate">{topic}</p>
                  <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0",
                    pct >= 70 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : pct >= 40 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  )}>{correct}/{total}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Gabarito */}
      <section>
        <h2 className="font-semibold mb-3">Gabarito</h2>
        <div className="space-y-2">
          {data.answers.map((ans, i) => (
            <div key={ans.questionId} className="rounded-xl border border-border bg-card overflow-hidden">
              <button className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}>
                {ans.isCorrect
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  : <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />}
                <span className="text-xs text-muted-foreground w-5 flex-shrink-0">{i + 1}</span>
                <span className="text-sm truncate flex-1">{ans.conteudo_principal}</span>
                <span className="text-xs text-muted-foreground hidden sm:block flex-shrink-0">
                  {ans.selectedAnswer ?? "—"} → {ans.gabarito}
                </span>
                {open === i ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </button>

              {open === i && (
                <div className="border-t border-border px-4 py-4 space-y-3">
                  <LatexRenderer fontSize="sm">{ans.enunciado}</LatexRenderer>
                  <div className="space-y-1.5">
                    {Object.entries(ans.alternativas as Record<string, string>).sort().map(([id, texto]) => (
                      <div key={id} className={cn("flex gap-2 px-3 py-2 rounded-lg text-sm",
                        id === ans.gabarito ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : id === ans.selectedAnswer ? "bg-rose-500/10 text-rose-800 dark:text-rose-300"
                        : "text-muted-foreground"
                      )}>
                        <span className="font-bold w-4 flex-shrink-0">{id}</span>
                        <LatexRenderer inline>{texto}</LatexRenderer>
                      </div>
                    ))}
                  </div>
                  {ans.comentario_resolucao && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Resolução</p>
                      <LatexRenderer fontSize="sm">{ans.comentario_resolucao}</LatexRenderer>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Tempo: {fmt(ans.timeSpentSeconds ?? null)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Acções */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={() => navigate("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-80">
          {passed ? <><Trophy className="h-4 w-4" />{data.stage < 3 ? `Etapa ${data.stage + 1}` : "Início"}</>
            : <><RefreshCw className="h-4 w-4" />Tentar novamente</>}
        </button>
        <button onClick={() => navigate("/historico")}
          className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
          Ver histórico
        </button>
      </div>
    </div>
  );
}
