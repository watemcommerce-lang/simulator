export default function Footer() {
  return (
    <footer style={{ background: "#01738d", marginTop: "4rem" }}>
      <div className="container mx-auto px-4 max-w-5xl py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* Logo e descrição */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/logo-vetor.png"
                alt="Vetor"
                className="h-14 w-14 object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
              <div>
                <p className="font-black text-white text-lg leading-none tracking-wide">VETOR</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Escola de Talentos</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)", maxWidth: 220 }}>
              Preparação inteligente para o ENEM com correção pela Teoria de Resposta ao Item.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
              Plataforma
            </p>
            <div className="space-y-2">
              {[
                { label: "Início", href: "/" },
                { label: "Simulado", href: "/simulado" },
                { label: "Banco de Questões", href: "/questoes" },
                { label: "Histórico", href: "/historico" },
              ].map(({ label, href }) => (
                <a key={href} href={href}
                  className="block text-sm transition-opacity hover:opacity-100"
                  style={{ color: "rgba(255,255,255,0.75)" }}>
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Sobre */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
              Sobre
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              Sistema de avaliação progressiva em 3 etapas com metodologia TRI, a mesma utilizada pelo INEP no ENEM.
            </p>
            <div className="flex gap-4 pt-2">
              <div>
                <p className="text-xl font-black text-white">3</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Etapas</p>
              </div>
              <div>
                <p className="text-xl font-black text-white">TRI</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Correção</p>
              </div>
              <div>
                <p className="text-xl font-black text-white">ENEM</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Formato real</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            © {new Date().getFullYear()} Escola Vetor. Todos os direitos reservados.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            Questões do ENEM — uso educacional
          </p>
        </div>
      </div>
    </footer>
  );
}
