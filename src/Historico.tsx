import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, Loader2, TrendingUp } from "lucide-react";

const STAGE_MIN_PASS = { 1: 12, 2: 18, 3: 0 };
const STAGE_TOTAL = { 1: 15, 2: 25, 3: 45 };

function formatTime(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m${sec > 0 ? ` ${sec}s` : ""}`;
}

export default function Historico() {
  const [, navigate] = useLocation();
  const [activeStage, setActiveStage] = useState<1 | 2 | 3>(1);

  const { data: history, isLoading } = trpc.simulations.getHistory.useQuery({
    stage: activeStage,
    limit: 30,
  });

  const { data: allHistory } = trpc.simulations.getHistory.useQuery({ limit: 100 });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Dados para o gráfico — usa allHistory para mostrar evolução geral
  const chartData = (allHistory ?? [])
    .slice()
    .reverse()
    .map((sim, idx) => ({
      idx: idx + 1,
      acertos: sim.correctCount ?? 0,
      total: sim.totalQuestions ?? 1,
      score: sim.score ?? 0,
      stage: sim.stage,
      date: sim.completedAt
        ? format(new Date(sim.completedAt), "dd/MM", { locale: ptBR })
        : "",
    }));

  const minPass = STAGE_MIN_PASS[activeStage];

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <p className="text-muted-foreground mt-1">O teu progresso ao longo do tempo.</p>
      </div>

      {/* Gráfico de evolução */}
      {chartData.length > 1 && (
        <section>
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Evolução de acertos
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [value, name === "acertos" ? "Acertos" : "Nota"]}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="acertos"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Filtro por etapa */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((stage) => (
          <button
            key={stage}
            onClick={() => setActiveStage(stage)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeStage === stage
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Etapa {stage}
          </button>
        ))}
      </div>

      {/* Lista de tentativas */}
      {!history || history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma tentativa registada na Etapa {activeStage}.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((sim) => {
            const passed =
              activeStage === 3 ||
              (sim.correctCount ?? 0) >= minPass;
            const total = sim.totalQuestions ?? STAGE_TOTAL[activeStage];

            return (
              <div
                key={sim.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/resultado/${sim.id}`)}
              >
                {/* Ícone aprovação */}
                {passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {sim.correctCount ?? 0}/{total} acertos
                    </span>
                    {activeStage === 3 && sim.score != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                        {sim.score.toFixed(0)} pts TRI
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sim.completedAt
                      ? format(new Date(sim.completedAt), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })
                      : "—"}
                  </p>
                </div>

                {/* Tempo */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(sim.totalTimeSeconds ?? null)}
                </div>

                {/* Barra de acertos */}
                <div className="w-20 hidden sm:block">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        passed ? "bg-emerald-500" : "bg-rose-500"
                      )}
                      style={{ width: `${Math.round(((sim.correctCount ?? 0) / total) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
