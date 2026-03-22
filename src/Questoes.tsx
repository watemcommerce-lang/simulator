import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { LatexRenderer } from "@/LatexRenderer";
import { ChevronDown, ChevronUp, Search, Loader2, Tag } from "lucide-react";

const TAGS_CONTEUDO = [
  "Razão, Proporção e Regra de Três",
  "Porcentagem",
  "Escala",
  "Operações Básicas",
  "Conversão de Unidades",
  "Geometria Espacial",
  "Geometria Plana",
  "Visualização Espacial/Projeção Ortogonal",
  "Trigonometria",
  "Leitura de Gráficos e Tabelas",
  "Medidas de Tendência Central",
  "Probabilidade",
  "Funções de 1º e 2º Grau",
  "Equações e Inequações",
  "Sequências",
  "Matemática Financeira",
  "Análise Combinatória",
  "Logaritmos",
];

export default function Questoes() {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("Todas");
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

  const allQuestions = data?.questions ?? [];

  // Filtra por tag no frontend
  const filtered = filterTag === "Todas"
    ? allQuestions
    : allQuestions.filter((q) => Array.isArray(q.tags) && q.tags.includes(filterTag));

  return (
    <div className="space-y-6 py-2">
      {/* Cabeçalho */}
      <div className="rounded-2xl px-6 py-6 text-white" style={{ background: "linear-gradient(135deg, #01738d, #00BFA5)" }}>
        <h1 className="text-xl font-bold">Banco de Questões</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
          {data?.pagination.total ?? "—"} questões de Matemática do ENEM
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#94A3B8" }} />
        <input type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); setFilterTag("Todas"); }}
          placeholder="Buscar por conteúdo..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: "1.5px solid #E2D9EE", background: "#fff", color: "#1A1A2E" }}
          onFocus={(e) => (e.target.style.borderColor = "#01738d")}
          onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
      </div>

      {/* Filtro por tag */}
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#64748B" }}>
          <Tag className="h-3.5 w-3.5" /> Filtrar por conteúdo:
        </p>
        <div className="flex flex-wrap gap-2">
          {["Todas", ...TAGS_CONTEUDO].map((tag) => (
            <button key={tag} onClick={() => { setFilterTag(tag); setPage(1); }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={filterTag === tag
                ? { background: "#01738d", color: "#fff" }
                : { background: "#E0F7F4", color: "#01738d" }}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Contador */}
      <p className="text-sm" style={{ color: "#64748B" }}>
        {filtered.length} questão(ões){filterTag !== "Todas" ? ` em "${filterTag}"` : ""}
        {data && data.pagination.totalPages > 1 && filterTag === "Todas" ? ` — página ${page} de ${data.pagination.totalPages}` : ""}
      </p>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="font-semibold" style={{ color: "#1A1A2E" }}>
            {filterTag !== "Todas" ? `Nenhuma questão com a tag "${filterTag}"` : "Nenhuma questão encontrada"}
          </p>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {filterTag !== "Todas"
              ? "Atribua esta tag às questões na área Admin."
              : "O banco de questões está vazio."}
          </p>
          {filterTag !== "Todas" && (
            <button onClick={() => setFilterTag("Todas")}
              className="text-sm font-semibold underline underline-offset-2" style={{ color: "#01738d" }}>
              Ver todas as questões
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const isOpen = openId === q.id;
            const qTags = Array.isArray(q.tags)
              ? q.tags.filter((t: string) => TAGS_CONTEUDO.includes(t))
              : [];

            return (
              <div key={q.id} className="rounded-xl overflow-hidden"
                style={{ border: "1.5px solid #E2D9EE", background: "#fff" }}>
                <button className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
                  onClick={() => setOpenId(isOpen ? null : q.id)}>
                  <div className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black"
                    style={{ background: "#E0F7F4", color: "#01738d" }}>
                    {q.conteudo_principal.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>
                      {q.conteudo_principal}
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>
                      ENEM {q.ano ?? ""} · {q.nivel_dificuldade}
                    </p>
                    {qTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {qTags.map((tag: string) => (
                          <button key={tag} onClick={(e) => { e.stopPropagation(); setFilterTag(tag); }}
                            className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors hover:opacity-80"
                            style={{ background: "#E0F7F4", color: "#00897B" }}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 flex-shrink-0 mt-1" style={{ color: "#94A3B8" }} />
                    : <ChevronDown className="h-4 w-4 flex-shrink-0 mt-1" style={{ color: "#94A3B8" }} />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 space-y-4" style={{ borderTop: "1px solid #E2D9EE" }}>
                    <div className="pt-4">
                      <LatexRenderer fontSize="sm">{q.enunciado}</LatexRenderer>
                    </div>
                    {q.url_imagem && (
                      <img src={q.url_imagem} alt="Imagem da questão" className="max-w-full rounded-lg"
                        style={{ border: "1px solid #E2D9EE" }} />
                    )}
                    <div className="space-y-1.5">
                      {Object.entries(q.alternativas as Record<string, any>).sort().map(([id, value]) => {
                        const text = typeof value === "object" ? value.text ?? "" : value;
                        const file = typeof value === "object" ? value.file : null;
                        return (
                          <div key={id} className="flex gap-2 px-3 py-2 rounded-lg text-sm"
                            style={{ background: "#F8FAFC" }}>
                            <span className="font-bold flex-shrink-0 w-4" style={{ color: "#01738d" }}>{id}</span>
                            <div className="flex-1">
                              {file && <img src={file} alt={`Alt ${id}`} className="max-w-xs rounded mb-1" />}
                              {text && <LatexRenderer inline>{text}</LatexRenderer>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {data && data.pagination.totalPages > 1 && filterTag === "Todas" && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "#F1F5F9", color: "#1A1A2E" }}>Anterior</button>
          <span className="text-sm" style={{ color: "#64748B" }}>{page} / {data.pagination.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "#F1F5F9", color: "#1A1A2E" }}>Próxima</button>
        </div>
      )}
    </div>
  );
}
