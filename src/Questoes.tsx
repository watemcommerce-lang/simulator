import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { LatexRenderer } from "@/LatexRenderer";
import { ChevronDown, ChevronUp, Search, Loader2 } from "lucide-react";

export default function Questoes() {
  const [search, setSearch] = useState("");
  const [topico, setTopico] = useState("Todos");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading } = trpc.questions.list.useQuery({
    page,
    pageSize: 20,
    conteudo: search || undefined,
    activeOnly: true,
    orderBy: "conteudo_principal",
    orderDir: "asc",
  });

  // Extrai tópicos únicos das questões carregadas
  const topicos = data
    ? ["Todos", ...Array.from(new Set(data.questions.map((q) => q.conteudo_principal))).sort()]
    : ["Todos"];

  const filtered = topico === "Todos"
    ? data?.questions ?? []
    : (data?.questions ?? []).filter((q) => q.conteudo_principal === topico);

  return (
    <div className="space-y-6 py-2">
      {/* Cabeçalho */}
      <div className="rounded-2xl px-6 py-6 text-white" style={{ background: "linear-gradient(135deg, #01738d, #00BFA5)" }}>
        <h1 className="text-xl font-bold">Banco de Questões</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
          Questões de Matemática do ENEM — organizadas por conteúdo
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#94A3B8" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); setTopico("Todos"); }}
          placeholder="Buscar por conteúdo ou tópico..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: "2px solid #E2D9EE", background: "#fff", color: "#1A1A2E" }}
          onFocus={(e) => (e.target.style.borderColor = "#01738d")}
          onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")}
        />
      </div>

      {/* Filtro por tópico */}
      {topicos.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {topicos.map((t) => (
            <button
              key={t}
              onClick={() => setTopico(t)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={
                topico === t
                  ? { background: "#01738d", color: "#fff" }
                  : { background: "#E0F7F4", color: "#01738d" }
              }
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Total */}
      {data && (
        <p className="text-sm" style={{ color: "#64748B" }}>
          {filtered.length} questão(ões)
          {topico !== "Todos" ? ` em "${topico}"` : ` — página ${page} de ${data.pagination.totalPages}`}
        </p>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="font-semibold" style={{ color: "#1A1A2E" }}>Nenhuma questão encontrada</p>
          <p className="text-sm" style={{ color: "#64748B" }}>
            Importe questões para começar.
          </p>
          <a
            href="/admin/import?secret=IMPORTAR2024&year=2023"
            target="_blank"
            className="inline-block px-5 py-2.5 rounded-xl text-white text-sm font-bold"
            style={{ background: "#01738d" }}
          >
            Importar questões ENEM 2023
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const isOpen = openId === q.id;
            return (
              <div key={q.id} className="rounded-xl overflow-hidden" style={{ border: "1.5px solid #E2D9EE", background: "#fff" }}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  onClick={() => setOpenId(isOpen ? null : q.id)}
                >
                  {/* Ícone de conteúdo */}
                  <div className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: "#E0F7F4", color: "#01738d" }}>
                    {q.conteudo_principal.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#1A1A2E" }}>
                      {q.conteudo_principal}
                    </p>
                    <p className="text-xs truncate" style={{ color: "#94A3B8" }}>
                      ENEM {q.ano ?? ""} · {q.nivel_dificuldade}
                    </p>
                  </div>

                  {isOpen
                    ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "#94A3B8" }} />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 space-y-4" style={{ borderTop: "1px solid #E2D9EE" }}>
                    <div className="pt-4">
                      <LatexRenderer fontSize="sm">{q.enunciado}</LatexRenderer>
                    </div>
                    {q.url_imagem && (
                      <img src={q.url_imagem} alt="Imagem da questão" className="max-w-full rounded-lg" style={{ border: "1px solid #E2D9EE" }} />
                    )}
                    <div className="space-y-1.5">
                      {Object.entries(q.alternativas as Record<string, string>).sort().map(([id, texto]) => (
                        <div key={id} className="flex gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "#F8FAFC" }}>
                          <span className="font-bold flex-shrink-0 w-4" style={{ color: "#01738d" }}>{id}</span>
                          <LatexRenderer inline>{texto}</LatexRenderer>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
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
      {data && data.pagination.totalPages > 1 && topico === "Todos" && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "#F1F5F9", color: "#1A1A2E" }}>
            Anterior
          </button>
          <span className="text-sm" style={{ color: "#64748B" }}>{page} / {data.pagination.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "#F1F5F9", color: "#1A1A2E" }}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
