import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Trash2, Loader2, Search, Shield, User,
  KeyRound, ChevronDown, ChevronUp, X, Check
} from "lucide-react";

type ActionState =
  | { type: "none" }
  | { type: "confirmDelete"; userId: number }
  | { type: "resetPassword"; userId: number; name: string };

export default function AdminUsuarios() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<ActionState>({ type: "none" });
  const [newPassword, setNewPassword] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.users.list.useQuery(
    { search: search || undefined },
    { refetchOnWindowFocus: false }
  );

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído.");
      setAction({ type: "none" });
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso.");
      setAction({ type: "none" });
      setNewPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleResetSubmit(userId: number) {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    resetMutation.mutate({ id: userId, newPassword });
  }

  const users_list = data ?? [];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.85rem",
    borderRadius: "0.75rem",
    border: "1.5px solid #E2D9EE",
    fontSize: "0.9rem",
    outline: "none",
    color: "#1A1A2E",
    background: "#fff",
  };

  return (
    <div className="space-y-6 py-2">

      {/* Cabeçalho */}
      <div className="rounded-2xl px-6 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #521F80, #01738d)" }}>
        <h1 className="text-xl font-bold">Usuários cadastrados</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
          {users_list.length} usuário(s) no total
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#94A3B8" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: "1.5px solid #E2D9EE", background: "#fff", color: "#1A1A2E" }}
          onFocus={(e) => (e.target.style.borderColor = "#01738d")}
          onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#01738d" }} />
        </div>
      ) : users_list.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: "#64748B" }}>
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {users_list.map((u) => {
            const isExpanded = expandedId === u.id;
            const isConfirmingDelete = action.type === "confirmDelete" && action.userId === u.id;
            const isResettingPassword = action.type === "resetPassword" && action.userId === u.id;

            return (
              <div key={u.id} className="rounded-xl overflow-hidden"
                style={{ border: "1.5px solid #E2D9EE", background: "#fff" }}>

                {/* Linha principal */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Avatar */}
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{
                      background: u.role === "admin" ? "#521F80" : "#E0F7F4",
                      color: u.role === "admin" ? "#fff" : "#01738d",
                    }}
                  >
                    {u.name[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "#1A1A2E" }}>{u.name}</p>
                      {u.role === "admin" && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: "#F3EAF9", color: "#521F80" }}>
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{u.email}</p>
                    <p className="text-xs" style={{ color: "#CBD5E1" }}>
                      Cadastrado em {new Date(u.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>

                  {/* Botões de acção (só para não-admins) */}
                  {u.role !== "admin" && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Redefinir senha */}
                      <button
                        onClick={() => {
                          setNewPassword("");
                          setAction(isResettingPassword
                            ? { type: "none" }
                            : { type: "resetPassword", userId: u.id, name: u.name });
                        }}
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ background: isResettingPassword ? "#E0F7F4" : "transparent" }}
                        title="Redefinir senha"
                      >
                        <KeyRound className="h-4 w-4" style={{ color: "#01738d" }} />
                      </button>

                      {/* Excluir */}
                      <button
                        onClick={() => setAction(isConfirmingDelete
                          ? { type: "none" }
                          : { type: "confirmDelete", userId: u.id })}
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ background: isConfirmingDelete ? "#FFEBEE" : "transparent" }}
                        title="Excluir usuário"
                      >
                        <Trash2 className="h-4 w-4" style={{ color: "#E53935" }} />
                      </button>

                      {/* Expandir */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : u.id)}
                        className="p-2 rounded-lg"
                        style={{ color: "#94A3B8" }}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Painel: confirmar exclusão */}
                {isConfirmingDelete && (
                  <div className="px-4 py-3 flex items-center gap-3 flex-wrap"
                    style={{ borderTop: "1px solid #FFCDD2", background: "#FFF5F5" }}>
                    <p className="text-sm font-semibold flex-1" style={{ color: "#C62828" }}>
                      Excluir "{u.name}"? Todos os simulados serão apagados.
                    </p>
                    <button
                      onClick={() => deleteMutation.mutate({ id: u.id })}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                      style={{ background: "#C62828" }}>
                      {deleteMutation.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      Confirmar exclusão
                    </button>
                    <button
                      onClick={() => setAction({ type: "none" })}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: "#F1F5F9", color: "#64748B" }}>
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Painel: redefinir senha */}
                {isResettingPassword && (
                  <div className="px-4 py-3 space-y-3"
                    style={{ borderTop: "1px solid #E0F7F4", background: "#F0FDFB" }}>
                    <p className="text-sm font-semibold" style={{ color: "#01738d" }}>
                      Nova senha para {u.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nova senha (mínimo 6 caracteres)"
                        style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                        onFocus={(e) => (e.target.style.borderColor = "#01738d")}
                        onBlur={(e) => (e.target.style.borderColor = "#E2D9EE")}
                        onKeyDown={(e) => e.key === "Enter" && handleResetSubmit(u.id)}
                      />
                      <button
                        onClick={() => handleResetSubmit(u.id)}
                        disabled={resetMutation.isPending || newPassword.length < 6}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: "#01738d" }}>
                        {resetMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Check className="h-3.5 w-3.5" />}
                        Redefinir
                      </button>
                      <button
                        onClick={() => { setAction({ type: "none" }); setNewPassword(""); }}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm"
                        style={{ color: "#64748B" }}>
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Expansão: detalhes */}
                {isExpanded && !isConfirmingDelete && !isResettingPassword && (
                  <div className="px-4 py-3 space-y-1"
                    style={{ borderTop: "1px solid #E2D9EE", background: "#F8FAFC" }}>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      <span className="font-semibold">ID:</span> {u.id}
                    </p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      <span className="font-semibold">E-mail:</span> {u.email}
                    </p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      <span className="font-semibold">Função:</span> {u.role === "admin" ? "Administrador" : "Aluno"}
                    </p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      <span className="font-semibold">Status:</span> {u.active ? "Ativo" : "Inativo"}
                    </p>
                    <p className="text-xs" style={{ color: "#64748B" }}>
                      <span className="font-semibold">Cadastrado:</span>{" "}
                      {new Date(u.createdAt).toLocaleString("pt-BR")}
                    </p>
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
