import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { LatexRenderer } from "@/LatexRenderer";
import { ChevronDown, ChevronUp, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NIVEIS = ["Todas", "Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"];

const NIVEL_COLORS: Record<string, { bg: string; text: string }> = {
  "Muito Baixa": { bg: "#E0F7F4", text: "#00897B" },
  "Baixa":       { bg: "#E0F7F4", text: "#00897B" },
  "Média":       { bg: "#FFF8E1", text: "#F57F17" },
  "Alta":        { bg: "#FFF3E0", text: "#E65100" },
  "Muito Alta":  { bg: "#FFEBEE", text: "#C62828" },
};

export default function Questoes() {
  const [search, setSearch] = useState("");
  const [nivel, setNivel] = useState("Todas");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading } = trpc.questions.list.useQuery({
    page,
    pageSize: 15,
    conteudo: search || undefined,
    nivel_dificuldade: nivel === "Todas" ? undefined : (nivel as any),
    activeOnly: true,
    orderBy: "id",
    orderDir: "asc",
  });

  return (
    <div className="space-y-6 py-2">
      {/* Cabeçalho */}
      <div
        className="rounded-2xl px-6 py-6 text-white"
        style={{ background: "linear-gradient(135deg, #01738d, #00BFA5)" }}
      >
        <h1 className="text-xl font-bold">Banco de Questões</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
          Questões de Matemática do ENEM
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#94A3B8" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por tópico..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: "2px solid #E2D9EE", background: "#fff", color: "#1A1A2E" }}
            onFocus={(e) => (e.target.style.borderColor = "#01738d")}
            onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")}
          />
        </div>

        {/* Filtro dificuldade */}
        <div className="flex gap-1.5 flex-wrap">
          {NIVEIS.map((n) => (
            <button
              key={n}
              onClick={() => { setNivel(n); setPage(1); }}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={
                nivel === n
                  ? { background: "#01738d", color: "#fff" }
                  : { background: "#F1F5F9", color: "#64748B" }
              }
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      {data && (
        <p className="text-sm" style={{ color: "#64748B" }}>
          {data.pagination.total} questão(ões) encontrada(s)
        </p>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
        </div>
      ) : data?.questions.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="font-semibold" style={{ color: "#1A1A2E" }}>Nenhuma questão encontrada</p>
          <p className="text-sm" style={{ color: "#64748B" }}>
            O banco de questões está vazio. Acesse o link abaixo para importar:
          </p>
          <a
            href="/admin/import?secret=IMPORTAR2024&year=2023"
            target="_blank"
            className="inline-block px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: "#01738d" }}
          >
            Importar questões ENEM 2023
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.questions.map((q) => {
            const isOpen = openId === q.id;
            const nColor = NIVEL_COLORS[q.nivel_dificuldade] ?? { bg: "#F1F5F9", text: "#64748B" };

            return (
              <div key={q.id} className="rounded-xl overflow-hidden" style={{ border: "1.5px solid #E2D9EE", background: "#fff" }}>
                {/* Linha resumo */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  onClick={() => setOpenId(isOpen ? null : q.id)}
                >
                  <span className="text-xs font-bold w-6 flex-shrink-0" style={{ color: "#94A3B8" }}>
                    {q.id}
                  </span>
                  <span className="text-sm flex-1 truncate font-medium" style={{ color: "#1A1A2E" }}>
                    {q.conteudo_principal} — {q.ano ?? "ENEM"}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 hidden sm:block"
                    style={{ background: nColor.bg, color: nColor.text }}
                  >
                    {q.nivel_dificuldade}
                  </span>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "#94A3B8" }} />}
                </button>

                {/* Expansão */}
                {isOpen && (
                  <div className="px-4 pb-5 space-y-4" style={{ borderTop: "1px solid #E2D9EE" }}>
                    <div className="pt-4">
                      <LatexRenderer fontSize="sm">{q.enunciado}</LatexRenderer>
                    </div>

                    {q.url_imagem && (
                      <img src={q.url_imagem} alt="Imagem da questão" className="max-w-full rounded-lg" style={{ border: "1px solid #E2D9EE" }} />
                    )}

                    {/* Alternativas */}
                    <div className="space-y-1.5">
                      {Object.entries(q.alternativas as Record<string, string>).sort().map(([id, texto]) => (
                        <div
                          key={id}
                          className="flex gap-2 px-3 py-2 rounded-lg text-sm"
                          style={{ background: "#F8FAFC", color: "#1A1A2E" }}
                        >
                          <span className="font-bold flex-shrink-0 w-4" style={{ color: "#01738d" }}>{id}</span>
                          <LatexRenderer inline>{texto}</LatexRenderer>
                        </div>
                      ))}
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(q.tags as string[])?.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E0F7F4", color: "#00897B" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "#F1F5F9", color: "#1A1A2E" }}
          >
            Anterior
          </button>
          <span className="text-sm" style={{ color: "#64748B" }}>
            {page} / {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "#F1F5F9", color: "#1A1A2E" }}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
