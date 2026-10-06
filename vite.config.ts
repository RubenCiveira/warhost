import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages sirve el proyecto en https://<user>.github.io/warhost/,
// así que en build los assets deben colgar de esa subruta y no de la raíz.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/warhost/" : "/",
  plugins: [react()],
  // Con `pnpm kit:local` el paquete resolveria su propia copia de React,
  // y dos copias rompen los hooks: se fuerza siempre la de la aplicacion.
  resolve: { dedupe: ["react", "react-dom"] },
  server: { port: 5173 },
}));
