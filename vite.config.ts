import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

// GitHub Pages sirve el proyecto en https://<user>.github.io/warhost/,
// así que en build los assets deben colgar de esa subruta y no de la raíz.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/warhost/" : "/",
  plugins: [react()],
  // opr-kit vive copiado en src/modules/opr-kit hasta que vuelva a ser un
  // paquete: se importa con su nombre de paquete para que sacarlo no obligue
  // a tocar las importaciones. El mismo alias esta en tsconfig.app.json.
  resolve: {
    alias: [{ find: /^@rubenciveira\/opr-kit\/(.*)$/, replacement: `${fileURLToPath(new URL("./src/modules/opr-kit/", import.meta.url))}$1` }],
  },
  server: { port: 5173 },
}));
