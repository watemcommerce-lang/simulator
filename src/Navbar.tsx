import { Link, useLocation } from "wouter";
import { useTheme } from "next-themes";
import { trpc } from "@/lib/trpc";
import { Moon, Sun, BookOpen, BarChart2, History, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { data: session } = trpc.auth.me.useQuery();

  const links = [
    { href: "/", label: "Início", icon: BookOpen },
    { href: "/historico", label: "Histórico", icon: History },
    { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 max-w-4xl flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <span className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 transition-opacity">
            <BarChart2 className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">Simulador ENEM</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon, adminOnly }) => {
            if (adminOnly && session?.role !== "admin") return null;
            const active = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </Link>
            );
          })}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User avatar */}
          {session && (
            <div className="ml-1 h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
              {session.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
