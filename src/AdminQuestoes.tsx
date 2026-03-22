import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { LatexRenderer } from "@/LatexRenderer";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Loader2, Search, X, Save, Tag } from "lucide-react";

const NIVEIS = ["Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"] as const;

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

const emptyForm = {
  fonte: "ENEM",
  ano: new Date().getFullYear(),
  conteudo_principal: "",
  nivel_dificuldade: "Média" as typeof NIVEIS[number],
  param_a: 1.0,
  param_b: 0.0,
  param_c: 0.2,
  enunciado: "",
  url_imagem: "",
  alternativas: { A: "", B: "", C: "", D: "", E: "" },
  gabarito: "A",
  comentario_resolucao: "",
  tags: [] as string[],
};

type Form = typeof emptyForm;

export default function AdminQuestoes() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("Todas");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [openId, setOpenId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.questions.list.useQuery({
    page, pageSize: 20,
    conteudo: search || undefined,
    activeOnly: false,
    orderBy: "conteudo_principal",
    orderDir: "asc",
  });

  const createMutation = trpc.questions.create.useMutation({
    onSuccess: () => { toast.success("Questão criada!"); resetForm(); utils.questions.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.questions.update.useMutation({
    onSuccess: () => { toast.success("Questão atualizada!"); resetForm(); utils.questions.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.questions.delete.useMutation({
    onSuccess: () => { toast.success("Questão removida."); utils.questions.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.questions.toggleActive.useMutation({
    onSuccess: () => utils.questions.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(q: any) {
    setForm({
      fonte: q.fonte ?? "ENEM",
      ano: q.ano ?? new Date().getFullYear(),
      conteudo_principal: q.conteudo_principal,
      nivel_dificuldade: q.nivel_dificuldade,
      param_a: q.param_a,
      param_b: q.param_b,
      param_c: q.param_c,
      enunciado: q.enunciado,
      url_imagem: q.url_imagem ?? "",
      alternativas: q.alternativas,
      gabarito: q.gabarito,
      comentario_resolucao: q.comentario_resolucao ?? "",
      tags: Array.isArray(q.tags) ? q.tags : [],
    });
    setEditId(q.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  function handleSubmit() {
    if (!form.conteudo_principal.trim()) { toast.error("Preencha o conteúdo principal."); return; }
    if (!form.enunciado.trim()) { toast.error("Preencha o enunciado."); return; }
    const payload = { ...form, url_imagem: form.url_imagem || null };
    if (editId) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const DELETE_PASSWORD = "ExcluirWaldo16@";

  const deleteAllMutation = trpc.questions.deleteAll.useMutation({
    onSuccess: () => {
      toast.success("Todas as questões foram excluídas.");
      setConfirmDelete(false);
      setDeletePassword("");
      utils.questions.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Filtra por tag no frontend
  const allQuestions = data?.questions ?? [];
  const filtered = filterTag === "Todas"
    ? allQuestions
    : allQuestions.filter((q) => Array.isArray(q.tags) && q.tags.includes(filterTag));

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none";
  const inputStyle = { border: "1.5px solid #E2D9EE", background: "#fff", color: "#1A1A2E" };
  const labelStyle: React.CSSProperties = { color: "#1A1A2E", fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: 4 };

  return (
    <div className="space-y-6 py-2">

      {/* Cabeçalho */}
      <div className="rounded-2xl px-6 py-5 text-white flex items-center justify-between gap-4"
        style={{ background: "linear-gradient(135deg, #521F80, #01738d)" }}>
        <div>
          <h1 className="text-xl font-bold">Gerenciar Questões</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
            {data?.pagination.total ?? 0} questões no banco
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
          <Plus className="h-4 w-4" /> Nova questão
        </button>
      </div>

      {/* Zona de perigo */}
      <div className="rounded-xl p-4" style={{ border: "1.5px solid #FFCDD2", background: "#FFF5F5" }}>
        {!confirmDelete ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold" style={{ color: "#C62828" }}>Zona de perigo</p>
              <p className="text-xs mt-0.5" style={{ color: "#E57373" }}>
                Excluir todas as questões é irreversível. Use para auditar o banco ano a ano.
              </p>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: "#FFCDD2", color: "#C62828", border: "1.5px solid #EF9A9A" }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir todas as questões
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-bold" style={{ color: "#C62828" }}>
              Confirme a senha para excluir todas as questões permanentemente.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Digite a senha de confirmação"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: "1.5px solid #EF9A9A", background: "#fff", color: "#1A1A2E", minWidth: 220 }}
                onFocus={(e) => (e.target.style.borderColor = "#C62828")}
                onBlur={(e) => (e.target.style.borderColor = "#EF9A9A")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deletePassword === DELETE_PASSWORD) {
                    deleteAllMutation.mutate();
                  }
                }}
              />
              <button
                onClick={() => {
                  if (deletePassword !== DELETE_PASSWORD) {
                    toast.error("Senha incorreta.");
                    setDeletePassword("");
                    return;
                  }
                  deleteAllMutation.mutate();
                }}
                disabled={deleteAllMutation.isPending || !deletePassword}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#C62828" }}
              >
                {deleteAllMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
                Confirmar exclusão
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setDeletePassword(""); }}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "#F1F5F9", color: "#64748B" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-2xl p-6 space-y-5" style={{ background: "#fff", border: "1.5px solid #E2D9EE" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg" style={{ color: "#1A1A2E" }}>
              {editId ? `Editar questão #${editId}` : "Nova questão"}
            </h2>
            <button onClick={resetForm}><X className="h-5 w-5" style={{ color: "#94A3B8" }} /></button>
          </div>

          {/* Metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>Conteúdo principal</label>
              <input className={inputClass} style={inputStyle} value={form.conteudo_principal}
                onChange={(e) => setForm({ ...form, conteudo_principal: e.target.value })}
                placeholder="Ex: Logaritmos"
                onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
            </div>
            <div>
              <label style={labelStyle}>Ano</label>
              <input className={inputClass} style={inputStyle} type="number" value={form.ano}
                onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })}
                onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
            </div>
            <div>
              <label style={labelStyle}>Dificuldade</label>
              <select className={inputClass} style={inputStyle} value={form.nivel_dificuldade}
                onChange={(e) => setForm({ ...form, nivel_dificuldade: e.target.value as any })}>
                {NIVEIS.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Tags de conteúdo */}
          <div>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
              <Tag className="h-3.5 w-3.5" style={{ color: "#01738d" }} />
              Tags de conteúdo
              <span style={{ fontWeight: 400, color: "#94A3B8", fontSize: "0.75rem" }}>
                — clique para selecionar (pode escolher várias)
              </span>
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TAGS_CONTEUDO.map((tag) => {
                const selected = form.tags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={selected
                      ? { background: "#01738d", color: "#fff", border: "1.5px solid #01738d" }
                      : { background: "#fff", color: "#01738d", border: "1.5px solid #01738d" }}>
                    {selected ? "✓ " : ""}{tag}
                  </button>
                );
              })}
            </div>
            {form.tags.length > 0 && (
              <p className="text-xs mt-2" style={{ color: "#64748B" }}>
                Selecionadas: {form.tags.join(", ")}
              </p>
            )}
          </div>

          {/* Enunciado */}
          <div>
            <label style={labelStyle}>Enunciado (suporta LaTeX com $...$)</label>
            <textarea className={inputClass} style={{ ...inputStyle, resize: "vertical" }} rows={5}
              value={form.enunciado}
              onChange={(e) => setForm({ ...form, enunciado: e.target.value })}
              placeholder="Texto do enunciado..."
              onFocus={(e) => (e.target.style.borderColor = "#01738d")}
              onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
          </div>

          <div>
            <label style={labelStyle}>URL da imagem do enunciado (opcional)</label>
            <input className={inputClass} style={inputStyle} value={form.url_imagem}
              onChange={(e) => setForm({ ...form, url_imagem: e.target.value })}
              placeholder="https://..."
              onFocus={(e) => (e.target.style.borderColor = "#01738d")}
              onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
          </div>

          {/* Alternativas */}
          <div>
            <label style={labelStyle}>Alternativas (suportam LaTeX)</label>
            <div className="space-y-2">
              {["A", "B", "C", "D", "E"].map((letra) => (
                <div key={letra} className="flex items-center gap-2">
                  <span className="font-black w-5 text-sm flex-shrink-0" style={{ color: "#01738d" }}>{letra}</span>
                  <input className={inputClass} style={inputStyle}
                    value={typeof form.alternativas[letra] === "object"
                      ? (form.alternativas[letra] as any).text ?? ""
                      : form.alternativas[letra] ?? ""}
                    onChange={(e) => setForm({ ...form, alternativas: { ...form.alternativas, [letra]: e.target.value } })}
                    placeholder={`Alternativa ${letra} — use $formula$ para LaTeX`}
                    onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                    onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
                </div>
              ))}
            </div>
          </div>

          {/* Gabarito + TRI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Gabarito</label>
              <select className={inputClass} style={inputStyle} value={form.gabarito}
                onChange={(e) => setForm({ ...form, gabarito: e.target.value })}>
                {["A", "B", "C", "D", "E"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Parâmetros TRI — discriminação (a) / dificuldade (b) / chute (c)</label>
              <div className="flex gap-2">
                {(["param_a", "param_b", "param_c"] as const).map((p, i) => (
                  <div key={p} className="flex-1">
                    <input type="number" step="0.1" className={inputClass} style={inputStyle}
                      value={form[p]}
                      onChange={(e) => setForm({ ...form, [p]: Number(e.target.value) })}
                      placeholder={["a", "b", "c"][i]}
                      onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                      onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resolução */}
          <div>
            <label style={labelStyle}>Resolução comentada (opcional — suporta LaTeX)</label>
            <textarea className={inputClass} style={{ ...inputStyle, resize: "vertical" }} rows={3}
              value={form.comentario_resolucao}
              onChange={(e) => setForm({ ...form, comentario_resolucao: e.target.value })}
              placeholder="Passo a passo da resolução..."
              onFocus={(e) => (e.target.style.borderColor = "#01738d")}
              onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={handleSubmit} disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: "#01738d" }}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editId ? "Salvar alterações" : "Criar questão"}
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "#F1F5F9", color: "#64748B" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Busca + filtro por tag */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#94A3B8" }} />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por conteúdo..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: "1.5px solid #E2D9EE", background: "#fff", color: "#1A1A2E" }}
            onFocus={(e) => (e.target.style.borderColor = "#01738d")}
            onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
        </div>

        {/* Filtro por tag */}
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#64748B" }}>
            <Tag className="h-3.5 w-3.5" /> Filtrar por tag:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {["Todas", ...TAGS_CONTEUDO].map((tag) => (
              <button key={tag} onClick={() => setFilterTag(tag)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                style={filterTag === tag
                  ? { background: "#01738d", color: "#fff" }
                  : { background: "#E0F7F4", color: "#01738d" }}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contador */}
      <p className="text-sm" style={{ color: "#64748B" }}>
        {filtered.length} questão(ões)
        {filterTag !== "Todas" ? ` com tag "${filterTag}"` : ""}
      </p>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const isOpen = openId === q.id;
            const qTags = Array.isArray(q.tags) ? q.tags.filter((t: string) => TAGS_CONTEUDO.includes(t)) : [];

            return (
              <div key={q.id} className="rounded-xl overflow-hidden"
                style={{ border: "1.5px solid #E2D9EE", background: q.active ? "#fff" : "#F8FAFC", opacity: q.active ? 1 : 0.6 }}>

                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setOpenId(isOpen ? null : q.id)} className="flex-1 flex items-start gap-3 text-left">
                    <span className="text-xs font-bold w-8 flex-shrink-0 mt-0.5" style={{ color: "#94A3B8" }}>#{q.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>{q.conteudo_principal}</p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>ENEM {q.ano} · {q.nivel_dificuldade} · Gabarito: {q.gabarito}</p>
                      {qTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {qTags.map((tag: string) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: "#E0F7F4", color: "#00897B" }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0 mt-1" style={{ color: "#94A3B8" }} />
                      : <ChevronDown className="h-4 w-4 flex-shrink-0 mt-1" style={{ color: "#94A3B8" }} />}
                  </button>

                  {/* Acções */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(q)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar">
                      <Pencil className="h-3.5 w-3.5" style={{ color: "#01738d" }} />
                    </button>
                    <button onClick={() => toggleMutation.mutate({ id: q.id, active: !q.active })}
                      className="p-1.5 rounded-lg hover:bg-gray-100" title={q.active ? "Desativar" : "Ativar"}>
                      {q.active
                        ? <EyeOff className="h-3.5 w-3.5" style={{ color: "#F57F17" }} />
                        : <Eye className="h-3.5 w-3.5" style={{ color: "#00897B" }} />}
                    </button>
                    <button onClick={() => { if (confirm("Excluir permanentemente?")) deleteMutation.mutate({ id: q.id }); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100" title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "#E53935" }} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #E2D9EE" }}>
                    <div className="pt-3">
                      <LatexRenderer fontSize="sm">{q.enunciado}</LatexRenderer>
                    </div>
                    {q.url_imagem && (
                      <img src={q.url_imagem} alt="" className="max-w-full rounded-lg" style={{ border: "1px solid #E2D9EE" }} />
                    )}
                    <div className="space-y-1">
                      {Object.entries(q.alternativas as Record<string, any>).sort().map(([id, value]) => {
                        const text = typeof value === "object" ? value.text ?? "" : value;
                        const file = typeof value === "object" ? value.file : null;
                        return (
                          <div key={id} className="flex gap-2 px-3 py-1.5 rounded-lg text-sm"
                            style={{ background: id === q.gabarito ? "#E0F7F4" : "#F8FAFC", border: id === q.gabarito ? "1px solid #00897B" : "none" }}>
                            <span className="font-bold w-4 flex-shrink-0" style={{ color: id === q.gabarito ? "#00897B" : "#01738d" }}>{id}</span>
                            <div className="flex-1">
                              {file && <img src={file} alt={`Alt ${id}`} className="max-w-xs rounded mb-1" />}
                              {text && <LatexRenderer inline>{text}</LatexRenderer>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {q.comentario_resolucao && (
                      <div className="rounded-lg p-3" style={{ background: "#F3EAF9" }}>
                        <p className="text-xs font-bold mb-1" style={{ color: "#521F80" }}>Resolução</p>
                        <LatexRenderer fontSize="sm">{q.comentario_resolucao}</LatexRenderer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {data && data.pagination.totalPages > 1 && filterTag === "Todas" && (
        <div className="flex items-center justify-center gap-2">
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
