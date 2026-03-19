import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Lock, CheckCircle2, PlayCircle, Trophy, Clock, Target, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_LABELS = ["Etapa 1", "Etapa 2", "Etapa 3"];
const STAGE_DESCRIPTIONS = [
  "15 questões · mínimo 12 acertos · 5 min/questão",
  "25 questões · mínimo 18 acertos · 4 min/questão",
  "45 questões · avaliação TRI · 3 min/questão",
];
const STAGE_COLORS = [
  { bg: "bg-blue-500/10", border: "border-blue-500/30", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { bg: "bg-violet-500/10", border: "border-violet-500/30", badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { bg: "bg-amber-500/10", border: "border-amber-500/30", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: progress, isLoading } = trpc.simulations.getProgress.useQuery();
  const { data: active } = trpc.simulations.getActive.useQuery();
  const startMutation = trpc.simulations.start.useMutation({
    onSuccess: () => navigate("/simulado"),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulador de Matemática</h1>
        <p className="text-muted-foreground mt-1">
          Progride pelas 3 etapas e conquista a nota máxima no ENEM.
        </p>
      </div>

      {/* Simulado em andamento */}
      {active && (
        <div
          className="flex items-center justify-between p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 cursor-pointer hover:bg-amber-500/15 transition-colors"
          onClick={() => navigate("/simulado")}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-sm">Simulado em andamento</p>
              <p className="text-xs text-muted-foreground">
                Etapa {active.stage} · {active.answeredCount}/{active.totalQuestions} respondidas
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Cards de etapa */}
      <div className="grid gap-4">
        {progress?.map((stage, idx) => {
          const colors = STAGE_COLORS[idx];
          const isLocked = !stage.unlocked;
          const isPassed = stage.passed;
          const canStart = stage.unlocked && !active;

          return (
            <div
              key={stage.stage}
              className={cn(
                "rounded-xl border p-5 transition-all",
                isLocked
                  ? "border-border bg-muted/30 opacity-60"
                  : cn("border", colors.border, colors.bg)
              )}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="flex items-start gap-4 flex-1">
                  {/* Ícone de estado */}
                  <div className={cn("mt-0.5 h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0",
                    isLocked ? "bg-muted" : colors.badge
                  )}>
                    {isLocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : isPassed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Target className="h-4 w-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold">{STAGE_LABELS[idx]}</h2>
                      {isPassed && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", colors.badge)}>
                          Concluída
                        </span>
                      )}
                      {isLocked && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Bloqueada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{STAGE_DESCRIPTIONS[idx]}</p>

                    {/* Melhor resultado */}
                    {stage.bestCorrectCount !== null && (
                      <div className="flex items-center gap-4 mt-3">
                        <Stat
                          label="Melhor resultado"
                          value={`${stage.bestCorrectCount}/${stage.totalQuestions}`}
                        />
                        {stage.bestScore !== null && (
                          <Stat
                            label={stage.stage === 3 ? "Nota TRI" : "Pontuação"}
                            value={stage.stage === 3 ? stage.bestScore.toFixed(0) : `${stage.bestScore}%`}
                          />
                        )}
                        <Stat label="Tentativas" value={String(stage.attempts)} />
                      </div>
                    )}

                    {/* Histórico recente — últimas 5 tentativas */}
                    {stage.recentAttempts.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-3">
                        <span className="text-xs text-muted-foreground mr-1">Últimas:</span>
                        {stage.recentAttempts.map((attempt, i) => {
                          const ratio = (attempt.correctCount ?? 0) / (attempt.totalQuestions ?? 1);
                          return (
                            <div
                              key={i}
                              className={cn(
                                "h-2 w-6 rounded-full transition-all",
                                ratio >= (stage.minPassRequired / stage.totalQuestions)
                                  ? "bg-emerald-500"
                                  : "bg-rose-400"
                              )}
                              title={`${attempt.correctCount}/${attempt.totalQuestions}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botão de acção */}
                {!isLocked && (
                  <button
                    onClick={() => {
                      if (active) {
                        navigate("/simulado");
                      } else {
                        startMutation.mutate({ stage: stage.stage as 1 | 2 | 3 });
                      }
                    }}
                    disabled={startMutation.isPending}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      "bg-foreground text-background hover:opacity-80 disabled:opacity-50",
                      "flex-shrink-0"
                    )}
                  >
                    {startMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                    {active ? "Continuar" : "Iniciar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trofeu Etapa 3 */}
      {progress?.find((s) => s.stage === 3 && s.passed) && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <Trophy className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm">
            Parabéns! Completaste todas as etapas.{" "}
            <button
              onClick={() => navigate("/historico")}
              className="underline underline-offset-2 hover:opacity-70"
            >
              Ver histórico completo
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
