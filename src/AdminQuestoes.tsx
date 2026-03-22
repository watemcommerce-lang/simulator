import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { LatexRenderer } from "@/LatexRenderer";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Eye, EyeOff,
  ChevronDown, ChevronUp, Loader2, Search, X, Save
} from "lucide-react";

const NIVEIS = ["Muito Baixa", "Baixa", "Média", "Alta", "Muito Alta"] as const;

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
      tags: q.tags ?? [],
    });
    setEditId(q.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit() {
    const payload = {
      ...form,
      url_imagem: form.url_imagem || null,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none";
  const inputStyle = { border: "1.5px solid #E2D9EE", background: "#fff", color: "#1A1A2E" };
  const labelStyle = { color: "#1A1A2E", fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: 4 };

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
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          <Plus className="h-4 w-4" /> Nova questão
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-2xl p-6 space-y-4" style={{ background: "#fff", border: "1.5px solid #E2D9EE" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: "#1A1A2E" }}>
              {editId ? "Editar questão" : "Nova questão"}
            </h2>
            <button onClick={resetForm}><X className="h-5 w-5" style={{ color: "#94A3B8" }} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>Conteúdo principal</label>
              <input className={inputClass} style={inputStyle} value={form.conteudo_principal}
                onChange={(e) => setForm({ ...form, conteudo_principal: e.target.value })}
                placeholder="Ex: Logaritmos" />
            </div>
            <div>
              <label style={labelStyle}>Ano</label>
              <input className={inputClass} style={inputStyle} type="number" value={form.ano}
                onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })} />
            </div>
            <div>
              <label style={labelStyle}>Dificuldade</label>
              <select className={inputClass} style={inputStyle} value={form.nivel_dificuldade}
                onChange={(e) => setForm({ ...form, nivel_dificuldade: e.target.value as any })}>
                {NIVEIS.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Enunciado (suporta LaTeX com $...$)</label>
            <textarea className={inputClass} style={{ ...inputStyle, resize: "vertical" }} rows={5}
              value={form.enunciado}
              onChange={(e) => setForm({ ...form, enunciado: e.target.value })}
              placeholder="Texto do enunciado..." />
          </div>

          <div>
            <label style={labelStyle}>URL da imagem (opcional)</label>
            <input className={inputClass} style={inputStyle} value={form.url_imagem}
              onChange={(e) => setForm({ ...form, url_imagem: e.target.value })}
              placeholder="https://..." />
          </div>

          <div>
            <label style={labelStyle}>Alternativas</label>
            <div className="space-y-2">
              {["A", "B", "C", "D", "E"].map((letra) => (
                <div key={letra} className="flex items-center gap-2">
                  <span className="font-bold w-5 text-sm flex-shrink-0" style={{ color: "#01738d" }}>{letra}</span>
                  <input className={inputClass} style={inputStyle} value={form.alternativas[letra] ?? ""}
                    onChange={(e) => setForm({ ...form, alternativas: { ...form.alternativas, [letra]: e.target.value } })}
                    placeholder={`Alternativa ${letra}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Gabarito</label>
              <select className={inputClass} style={inputStyle} value={form.gabarito}
                onChange={(e) => setForm({ ...form, gabarito: e.target.value })}>
                {["A", "B", "C", "D", "E"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Parâmetros TRI (a / b / c)</label>
              <div className="flex gap-2">
                {(["param_a", "param_b", "param_c"] as const).map((p) => (
                  <input key={p} type="number" step="0.1" className={inputClass} style={inputStyle}
                    value={form[p]}
                    onChange={(e) => setForm({ ...form, [p]: Number(e.target.value) })} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Resolução comentada (opcional)</label>
            <textarea className={inputClass} style={{ ...inputStyle, resize: "vertical" }} rows={3}
              value={form.comentario_resolucao}
              onChange={(e) => setForm({ ...form, comentario_resolucao: e.target.value })}
              placeholder="Passo a passo da resolução..." />
          </div>

          <div className="flex gap-3">
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

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#94A3B8" }} />
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por conteúdo..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: "1.5px solid #E2D9EE", background: "#fff", color: "#1A1A2E" }} />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} /></div>
      ) : (
        <div className="space-y-2">
          {data?.questions.map((q) => {
            const isOpen = openId === q.id;
            return (
              <div key={q.id} className="rounded-xl overflow-hidden"
                style={{ border: "1.5px solid #E2D9EE", background: q.active ? "#fff" : "#F8FAFC", opacity: q.active ? 1 : 0.6 }}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setOpenId(isOpen ? null : q.id)} className="flex-1 flex items-center gap-3 text-left">
                    <span className="text-xs font-bold w-8 flex-shrink-0" style={{ color: "#94A3B8" }}>#{q.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#1A1A2E" }}>{q.conteudo_principal}</p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>ENEM {q.ano} · {q.nivel_dificuldade} · Gabarito: {q.gabarito}</p>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: "#94A3B8" }} />
                      : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "#94A3B8" }} />}
                  </button>

                  {/* Acções */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(q)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Editar">
                      <Pencil className="h-3.5 w-3.5" style={{ color: "#01738d" }} />
                    </button>
                    <button onClick={() => toggleMutation.mutate({ id: q.id, active: !q.active })} className="p-1.5 rounded-lg hover:bg-gray-100" title={q.active ? "Desativar" : "Ativar"}>
                      {q.active ? <EyeOff className="h-3.5 w-3.5" style={{ color: "#F57F17" }} /> : <Eye className="h-3.5 w-3.5" style={{ color: "#00897B" }} />}
                    </button>
                    <button onClick={() => { if (confirm("Excluir permanentemente?")) deleteMutation.mutate({ id: q.id }); }} className="p-1.5 rounded-lg hover:bg-gray-100" title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "#E53935" }} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #E2D9EE" }}>
                    <div className="pt-3">
                      <LatexRenderer fontSize="sm">{q.enunciado}</LatexRenderer>
                    </div>
                    {q.url_imagem && <img src={q.url_imagem} alt="" className="max-w-full rounded-lg" style={{ border: "1px solid #E2D9EE" }} />}
                    <div className="space-y-1">
                      {Object.entries(q.alternativas as Record<string, string>).sort().map(([id, texto]) => (
                        <div key={id} className="flex gap-2 px-3 py-1.5 rounded-lg text-sm"
                          style={{ background: id === q.gabarito ? "#E0F7F4" : "#F8FAFC", border: id === q.gabarito ? "1px solid #00897B" : "none" }}>
                          <span className="font-bold w-4 flex-shrink-0" style={{ color: id === q.gabarito ? "#00897B" : "#01738d" }}>{id}</span>
                          <LatexRenderer inline>{texto}</LatexRenderer>
                        </div>
                      ))}
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
      {data && data.pagination.totalPages > 1 && (
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
