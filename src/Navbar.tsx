import { Link, useLocation } from "wouter";
import { useTheme } from "next-themes";
import { trpc } from "@/lib/trpc";
import { Moon, Sun, BarChart2, History, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { data: session } = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const links = [
    { href: "/", label: "Início" },
    { href: "/historico", label: "Histórico" },
    ...(session?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header
      className="sticky top-0 z-50"
      style={{ backgroundColor: "#01738d", boxShadow: "0 2px 8px rgba(1,115,141,0.3)" }}
    >
      <div className="container mx-auto px-4 max-w-5xl flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <span className="flex items-center gap-2 font-bold text-white text-base hover:opacity-85 transition-opacity">
            <BarChart2 className="h-5 w-5 text-white" />
            Simulador ENEM
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link key={href} href={href}>
                <span
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={
                    active
                      ? { backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }
                      : { color: "rgba(255,255,255,0.8)" }
                  }
                  onMouseEnter={(e) => { if (!active) (e.target as HTMLElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { if (!active) (e.target as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.8)" }}
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Avatar */}
          {session && (
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }}
              title={session.name}
            >
              {(session.name as string)?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}

          {/* Botão Sair */}
          {session && (
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ml-1"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
              title="Sair da conta"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
