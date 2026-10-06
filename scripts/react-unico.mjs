/**
 * Alias de esbuild para que los scripts que pintan componentes usen una sola
 * copia de React. Con `pnpm kit:local`, el paquete resolveria la suya
 * desde su propio node_modules y dos copias rompen los hooks; es lo mismo que
 * hace `resolve.dedupe` en vite.config.ts.
 */
export const REACT_UNICO = { react: "./node_modules/react", "react-dom": "./node_modules/react-dom" };
