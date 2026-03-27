import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { LogOut, Users } from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const { data: session } = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const links = [
    { href: "/", label: "Início" },
    { href: "/simulado", label: "Simulado" },
    { href: "/questoes", label: "Questões" },
    { href: "/historico", label: "Histórico" },
    { href: "/treino", label: "Treino" },
    { href: "/ranking", label: "Ranking" },
    ...(session?.role === "admin" ? [{ href: "/admin/questoes", label: "Admin" }] : []),
  ];

  function isActive(href: string) {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50"
      style={{ backgroundColor: "#01738d", boxShadow: "0 2px 8px rgba(1,115,141,0.3)" }}>
      <div className="container mx-auto px-4 max-w-5xl flex h-16 items-center justify-between">

        {/* Logo */}
        <Link href="/">
          <span className="flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer">
            <img
              src="/logo-vetor.png"
              alt="Vetor"
              className="h-10 w-10 object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <div className="hidden sm:block">
              <p className="font-black text-white text-sm leading-none tracking-wide">VETOR</p>
              <p className="text-xs leading-none" style={{ color: "rgba(255,255,255,0.7)" }}>
                Escola de Talentos
              </p>
            </div>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}>
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={isActive(href)
                  ? { backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }
                  : { color: "rgba(255,255,255,0.8)" }}>
                {label}
              </span>
            </Link>
          ))}

          {/* Ícone usuários — só admin */}
          {session?.role === "admin" && (
            <Link href="/admin/usuarios">
              <span
                className="flex items-center justify-center h-8 w-8 rounded-lg ml-1 transition-colors cursor-pointer"
                style={isActive("/admin/usuarios")
                  ? { backgroundColor: "rgba(255,255,255,0.25)" }
                  : { backgroundColor: "rgba(255,255,255,0.12)" }}
                title="Gerenciar usuários"
              >
                <Users className="h-4 w-4 text-white" />
              </span>
            </Link>
          )}

          {/* Avatar */}
          {session && (
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ml-1"
              style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }}
              title={session.name as string}>
              {(session.name as string)?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}

          {/* Sair */}
          {session && (
            <button onClick={() => logout.mutate()} disabled={logout.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ml-1"
              style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
