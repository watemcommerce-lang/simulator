import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Trash2, Loader2, Search, Shield, KeyRound,
  ChevronDown, ChevronUp, X, Check, Calendar,
  PlusCircle, MinusCircle, Clock
} from "lucide-react";

type ActionState =
  | { type: "none" }
  | { type: "confirmDelete"; userId: number }
  | { type: "resetPassword"; userId: number; name: string }
  | { type: "setSubscription"; userId: number; name: string };

const STATUS_CONFIG = {
  admin:          { label: "Admin",           bg: "#F3EAF9", color: "#521F80" },
  ativa:          { label: "Assinatura ativa", bg: "#E0F7F4", color: "#00897B" },
  expirada:       { label: "Expirada",         bg: "#FFEBEE", color: "#C62828" },
  sem_assinatura: { label: "Sem assinatura",   bg: "#F1F5F9", color: "#64748B" },
};

export default function AdminUsuarios() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<ActionState>({ type: "none" });
  const [newPassword, setNewPassword] = useState("");
  const [months, setMonths] = useState(12);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.users.list.useQuery({ search: search || undefined });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("Usuário excluído."); setAction({ type: "none" }); utils.users.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => { toast.success("Senha redefinida."); setAction({ type: "none" }); setNewPassword(""); },
    onError: (e) => toast.error(e.message),
  });

  const subMutation = trpc.users.setSubscription.useMutation({
    onSuccess: (d) => {
      const date = new Date(d.expiresAt).toLocaleDateString("pt-BR");
      toast.success(`Assinatura ativa até ${date}`);
      setAction({ type: "none" });
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.users.revokeSubscription.useMutation({
    onSuccess: () => { toast.success("Assinatura revogada."); utils.users.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const users_list = data ?? [];
  const inputStyle: React.CSSProperties = {
    padding: "0.6rem 0.85rem", borderRadius: "0.75rem",
    border: "1.5px solid #E2D9EE", fontSize: "0.875rem",
    outline: "none", color: "#1A1A2E", background: "#fff",
  };

  // Resumo
  const ativas = users_list.filter((u) => u.subscriptionStatus === "ativa").length;
  const expiradas = users_list.filter((u) => u.subscriptionStatus === "expirada").length;
  const semAssinatura = users_list.filter((u) => u.subscriptionStatus === "sem_assinatura").length;

  return (
    <div className="space-y-6 py-2">

      {/* Cabeçalho */}
      <div className="rounded-2xl px-6 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #521F80, #01738d)" }}>
        <h1 className="text-xl font-bold">Usuários e Assinaturas</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
          {users_list.length} usuário(s) cadastrado(s)
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Ativas", value: ativas, bg: "#E0F7F4", color: "#00897B" },
          { label: "Expiradas", value: expiradas, bg: "#FFEBEE", color: "#C62828" },
          { label: "Sem assinatura", value: semAssinatura, bg: "#F1F5F9", color: "#64748B" },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: bg, border: `1.5px solid ${color}33` }}>
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#94A3B8" }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: "1.5px solid #E2D9EE", background: "#fff", color: "#1A1A2E" }}
          onFocus={(e) => (e.target.style.borderColor = "#01738d")}
          onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")} />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
        </div>
      ) : users_list.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: "#64748B" }}>Nenhum usuário encontrado.</div>
      ) : (
        <div className="space-y-2">
          {users_list.map((u) => {
            const isExpanded = expandedId === u.id;
            const isConfirmingDelete = action.type === "confirmDelete" && action.userId === u.id;
            const isResetting = action.type === "resetPassword" && action.userId === u.id;
            const isSettingSub = action.type === "setSubscription" && action.userId === u.id;
            const statusCfg = STATUS_CONFIG[u.subscriptionStatus as keyof typeof STATUS_CONFIG];

            return (
              <div key={u.id} className="rounded-xl overflow-hidden"
                style={{ border: "1.5px solid #E2D9EE", background: "#fff" }}>

                {/* Linha principal */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: u.role === "admin" ? "#521F80" : "#E0F7F4", color: u.role === "admin" ? "#fff" : "#01738d" }}>
                    {u.name[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>{u.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {u.role === "admin" && <Shield className="h-3 w-3" />}
                        {statusCfg.label}
                      </span>
                      {u.daysRemaining !== null && (
                        <span className="text-xs" style={{ color: u.daysRemaining <= 30 ? "#E65100" : "#64748B" }}>
                          {u.daysRemaining <= 30
                            ? `⚠ ${u.daysRemaining} dias restantes`
                            : `${u.daysRemaining} dias restantes`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{u.email}</p>
                    {u.subscriptionExpiresAt && (
                      <p className="text-xs" style={{ color: "#94A3B8" }}>
                        {u.subscriptionStatus === "expirada" ? "Expirou" : "Expira"} em{" "}
                        {new Date(u.subscriptionExpiresAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>

                  {/* Acções */}
                  {u.role !== "admin" && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setAction(isSettingSub ? { type: "none" } : { type: "setSubscription", userId: u.id, name: u.name }); }}
                        className="p-2 rounded-lg transition-colors" title="Gerenciar assinatura"
                        style={{ background: isSettingSub ? "#E0F7F4" : "transparent" }}>
                        <Calendar className="h-4 w-4" style={{ color: "#01738d" }} />
                      </button>
                      <button onClick={() => { setNewPassword(""); setAction(isResetting ? { type: "none" } : { type: "resetPassword", userId: u.id, name: u.name }); }}
                        className="p-2 rounded-lg transition-colors" title="Redefinir senha"
                        style={{ background: isResetting ? "#E0F7F4" : "transparent" }}>
                        <KeyRound className="h-4 w-4" style={{ color: "#01738d" }} />
                      </button>
                      <button onClick={() => setAction(isConfirmingDelete ? { type: "none" } : { type: "confirmDelete", userId: u.id })}
                        className="p-2 rounded-lg transition-colors" title="Excluir"
                        style={{ background: isConfirmingDelete ? "#FFEBEE" : "transparent" }}>
                        <Trash2 className="h-4 w-4" style={{ color: "#E53935" }} />
                      </button>
                      <button onClick={() => setExpandedId(isExpanded ? null : u.id)}
                        className="p-2 rounded-lg" style={{ color: "#94A3B8" }}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Painel: gerenciar assinatura */}
                {isSettingSub && (
                  <div className="px-4 py-4 space-y-3" style={{ borderTop: "1px solid #E0F7F4", background: "#F0FDFB" }}>
                    <p className="text-sm font-bold" style={{ color: "#01738d" }}>
                      Assinatura de {u.name}
                    </p>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setMonths((m) => Math.max(1, m - 1))}
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ background: "#E0F7F4", color: "#01738d" }}>
                          <MinusCircle className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-bold w-28 text-center" style={{ color: "#1A1A2E" }}>
                          {months} {months === 1 ? "mês" : "meses"}
                        </span>
                        <button onClick={() => setMonths((m) => Math.min(24, m + 1))}
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ background: "#E0F7F4", color: "#01738d" }}>
                          <PlusCircle className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {[1, 3, 6, 12].map((m) => (
                          <button key={m} onClick={() => setMonths(m)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            style={months === m
                              ? { background: "#01738d", color: "#fff" }
                              : { background: "#E0F7F4", color: "#01738d" }}>
                            {m === 1 ? "1 mês" : m === 12 ? "1 ano" : `${m} meses`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Previsão */}
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      <Clock className="h-3 w-3 inline mr-1" />
                      Expira em:{" "}
                      <strong>
                        {(() => {
                          const base = u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date()
                            ? new Date(u.subscriptionExpiresAt)
                            : new Date();
                          base.setMonth(base.getMonth() + months);
                          return base.toLocaleDateString("pt-BR");
                        })()}
                      </strong>
                      {u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date() && (
                        <span style={{ color: "#00897B" }}> (renovação a partir da data actual)</span>
                      )}
                    </p>

                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => subMutation.mutate({ id: u.id, months })} disabled={subMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: "#01738d" }}>
                        {subMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Confirmar assinatura
                      </button>
                      {u.subscriptionExpiresAt && (
                        <button onClick={() => { if (confirm("Revogar assinatura?")) revokeMutation.mutate({ id: u.id }); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
                          style={{ background: "#FFEBEE", color: "#C62828" }}>
                          <MinusCircle className="h-3.5 w-3.5" /> Revogar
                        </button>
                      )}
                      <button onClick={() => setAction({ type: "none" })}
                        className="px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "#F1F5F9", color: "#64748B" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Painel: redefinir senha */}
                {isResetting && (
                  <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid #E0F7F4", background: "#F0FDFB" }}>
                    <p className="text-sm font-semibold" style={{ color: "#01738d" }}>Nova senha para {u.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nova senha (mínimo 6 caracteres)"
                        style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                        onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                        onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")}
                        onKeyDown={(e) => e.key === "Enter" && resetMutation.mutate({ id: u.id, newPassword })} />
                      <button onClick={() => resetMutation.mutate({ id: u.id, newPassword })}
                        disabled={resetMutation.isPending || newPassword.length < 6}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: "#01738d" }}>
                        {resetMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Redefinir
                      </button>
                      <button onClick={() => { setAction({ type: "none" }); setNewPassword(""); }}
                        className="px-3 py-2 rounded-xl text-sm" style={{ color: "#64748B" }}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Painel: confirmar exclusão */}
                {isConfirmingDelete && (
                  <div className="px-4 py-3 flex items-center gap-3 flex-wrap"
                    style={{ borderTop: "1px solid #FFCDD2", background: "#FFF5F5" }}>
                    <p className="text-sm font-semibold flex-1" style={{ color: "#C62828" }}>
                      Excluir "{u.name}"? Todos os dados serão apagados.
                    </p>
                    <button onClick={() => deleteMutation.mutate({ id: u.id })} disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                      style={{ background: "#C62828" }}>
                      {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Confirmar
                    </button>
                    <button onClick={() => setAction({ type: "none" })}
                      className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "#F1F5F9", color: "#64748B" }}>
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Expansão: detalhes */}
                {isExpanded && !isConfirmingDelete && !isResetting && !isSettingSub && (
                  <div className="px-4 py-3 space-y-1" style={{ borderTop: "1px solid #E2D9EE", background: "#F8FAFC" }}>
                    <p className="text-xs" style={{ color: "#64748B" }}><span className="font-semibold">ID:</span> {u.id}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}><span className="font-semibold">E-mail:</span> {u.email}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}><span className="font-semibold">Função:</span> {u.role === "admin" ? "Administrador" : "Aluno"}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}><span className="font-semibold">Status:</span> {u.active ? "Ativo" : "Inativo"}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      <span className="font-semibold">Assinatura:</span>{" "}
                      {u.subscriptionExpiresAt
                        ? `${u.subscriptionStatus === "expirada" ? "Expirou" : "Expira"} em ${new Date(u.subscriptionExpiresAt).toLocaleDateString("pt-BR")}`
                        : "Sem assinatura definida"}
                    </p>
                    <p className="text-xs" style={{ color: "#64748B" }}><span className="font-semibold">Cadastrado:</span> {new Date(u.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
