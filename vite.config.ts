import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const escaparRegExp = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GitHub Pages sirve el proyecto en https://<user>.github.io/warhost/,
// así que en build los assets deben colgar de esa subruta y no de la raíz.
export default defineConfig(({ command, mode }) => ({
  base: command === "build" ? "/warhost/" : "/",
  plugins: [
    react(),
    // PWA instalable que abre sin cobertura: el service worker precachea la app
    // entera y sirve index.html a cualquier ruta, para que el router decida. Los
    // datos no pasan por aqui: los ejercitos tienen su copia en localStorage.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Warhost",
        short_name: "Warhost",
        description: "Ejercitos, misiones y reglas para los sistemas de One Page Rules.",
        lang: "es",
        theme_color: "#12171a",
        background_color: "#0e1113",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ttf}"],
        runtimeCaching: [
          {
            // Portadas y avatares: los ficheros de Appwrite no cambian de id
            // al cambiar de contenido, asi que lo ya visto vale sin cobertura.
            urlPattern: new RegExp(`^${escaparRegExp(loadEnv(mode, process.cwd()).VITE_APPWRITE_ENDPOINT ?? "")}/storage/`),
            handler: "CacheFirst",
            options: {
              cacheName: "imagenes-appwrite",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "fuentes",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  // opr-kit vive copiado en src/modules/opr-kit hasta que vuelva a ser un
  // paquete: se importa con su nombre de paquete para que sacarlo no obligue
  // a tocar las importaciones. El mismo alias esta en tsconfig.app.json.
  resolve: {
    alias: [{ find: /^@rubenciveira\/opr-kit\/(.*)$/, replacement: `${fileURLToPath(new URL("./src/modules/opr-kit/", import.meta.url))}$1` }],
  },
  server: { port: 5173 },
}));
