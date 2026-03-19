import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Ajustado para procurar na mesma pasta onde o ficheiro está
      "@": path.resolve(import.meta.dirname, ""), 
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  // Removemos a configuração 'root' e 'client' para ele ler os ficheiros soltos
});
