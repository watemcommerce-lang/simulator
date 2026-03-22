import { build } from "esbuild";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, "server/index.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: resolve(__dirname, "dist/index.js"),
  packages: "external",
});

console.log("Server build concluído.");
