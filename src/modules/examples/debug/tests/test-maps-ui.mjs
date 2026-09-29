import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const directory = await mkdtemp(join(tmpdir(), "warhost-maps-"));
await build({
  stdin: {
    contents: 'import { createRoot } from "react-dom/client"; import MapLab from "./presentation/MapLab"; createRoot(document.getElementById("root")).render(<MapLab />);',
    resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "tsx",
  },
  outfile: join(directory, "app.js"), bundle: true, platform: "browser", format: "iife", jsx: "automatic",
});
await writeFile(join(directory, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${await readFile(join(directory, "app.css"), "utf8")}</style></head><body style="margin: 0; padding: 12px"><main><div id="root"></div></main><script>${await readFile(join(directory, "app.js"), "utf8")}</script></body></html>`);
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`file://${join(directory, "index.html")}`);
  await page.getByRole("button", { name: "Abrir Sala de guardia", exact: true }).click();
  await page.getByRole("button", { name: "Buscar trampas", exact: true }).click();
  await page.getByRole("button", { name: /Casilla 3, 2:/ }).click();
  await page.getByRole("button", { name: "Abrir cofre", exact: true }).click();
  await page.getByRole("button", { name: /Casilla 8, 4:/ }).click();
  await page.getByRole("button", { name: "Ir a Cripta sumergida" }).click();
  assert.equal(await page.getByRole("button", { name: "Buscar trampas", exact: true }).isEnabled(), true);
  await page.getByRole("button", { name: "Ir a Sala de guardia" }).click();
  assert.equal(await page.getByRole("button", { name: "Buscar trampas", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: /Casilla 3, 2:/ }).click();
  assert.equal(await page.getByRole("button", { name: "Abrir cofre", exact: true }).isDisabled(), true);
  await page.screenshot({ path: join(directory, "desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Volver al listado" }).click();
  await page.getByRole("button", { name: "Abrir El paso del río", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: /Ir a / }).count(), 0);
  await page.getByRole("button", { name: /Casilla 6, 5:/ }).click();
  await page.getByRole("button", { name: "Controlar objetivo", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Controlar objetivo", exact: true }).isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(directory, "mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Reiniciar exploración" }).click();
  assert.equal(await page.getByRole("button", { name: "Controlar objetivo", exact: true }).isEnabled(), true);

  await page.getByRole("button", { name: "Volver al listado" }).click();
  await page.getByRole("button", { name: "Crear mapa", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Galería hexagonal");
  await page.getByLabel("Cuadrícula", { exact: true }).selectOption("hex");
  await page.getByLabel("Tipo de lugar").selectOption("corridor");
  await page.getByLabel("Columnas").fill("6");
  await page.getByLabel("Filas").fill("4");
  await page.getByRole("button", { name: "Crear borrador" }).click();
  assert.equal(await page.locator(".map-board--hex .map-cell").count(), 24);
  await page.getByLabel("Herramienta", { exact: true }).selectOption("difficult");
  await page.getByRole("button", { name: /Casilla 2, 2:/ }).click();
  await page.getByLabel("Herramienta", { exact: true }).selectOption("prop");
  await page.getByLabel("Nombre del atrezo").fill("Estatua");
  await page.getByRole("button", { name: /Casilla 3, 2:/ }).click();
  await page.getByLabel("Herramienta", { exact: true }).selectOption("exit");
  await page.getByRole("button", { name: /Casilla 1, 2:/ }).click();
  await page.reload();
  await page.getByRole("button", { name: "Abrir Galería hexagonal" }).click();
  assert.equal(await page.getByRole("button", { name: /Casilla 2, 2: Difícil/ }).count(), 1);
  assert.equal(await page.getByRole("button", { name: /Casilla 3, 2:.*Estatua/ }).count(), 1);
  assert.equal(await page.getByRole("button", { name: /Casilla 1, 2:.*puerta/ }).count(), 1);
  await page.getByRole("button", { name: "Marcar como configurado" }).click();
  assert.equal(await page.getByLabel("Herramienta", { exact: true }).count(), 0);
  await page.reload();
  await page.getByRole("button", { name: "Abrir Galería hexagonal" }).click();
  assert.equal(await page.getByRole("button", { name: "Volver a editar" }).count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(directory, "hex-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Volver a editar" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: join(directory, "editor.png"), fullPage: true });
  await page.getByRole("button", { name: "Volver al listado" }).click();
  await page.getByRole("button", { name: "Abrir Sala de guardia" }).click();
  assert.equal(await page.getByRole("button", { name: "Buscar trampas", exact: true }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log(`Interacciones y vista móvil correctas. Capturas: ${directory}`);
} finally {
  await browser.close();
}
