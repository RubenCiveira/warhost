/**
 * El plan para ajustar una lista al libro actual: que una lista que encaja no
 * pida nada, que una que no encaja diga cada cosa que sobra y quede bien
 * despues de aplicarlo, y que una lista real de Army Forge montada con una
 * version anterior del libro se detecte como desfasada.
 *
 *   pnpm test:migracion
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALIAS_OPR_KIT } from "./alias-opr-kit.mjs";

const CLI_CWD = process.env.APPWRITE_DIR ?? "../warhost-appwrite";
// Lista de comunidad de Battle Brothers guardada con el libro en la 3.4.4.
const LISTA_ANTIGUA = "ZqVBFiF0WAQM";

const dir = await mkdtemp(join(tmpdir(), "warhost-migracion-"));
const outfile = join(dir, "migracion.mjs");
await build({
  stdin: {
    contents: [
      'export * from "@rubenciveira/opr-kit/core/builder";',
      'export * from "@rubenciveira/opr-kit/core/migracion";',
      'export { librosDesfasados } from "./src/lib/armyPayload";',
    ].join("\n"),
    resolveDir: process.cwd(),
    loader: "ts",
  },
  alias: ALIAS_OPR_KIT,
  outfile,
  format: "esm",
  bundle: true,
  platform: "node",
  logLevel: "error",
});
const M = await import(outfile);

const filas = (tabla, queries) =>
  JSON.parse(execFileSync("appwrite", ["tables-db", "list-rows", "--database-id", "warhost", "--table-id", tabla, "--json",
    ...queries.flatMap((q) => ["--queries", JSON.stringify(q)])], { encoding: "utf8", cwd: CLI_CWD, maxBuffer: 256e6 })).rows;

let fallos = 0;
const comprobar = (ok, que, detalle) => {
  console.log(`  ${ok ? "✓" : "✗"} ${que}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos += 1;
};

const libro = filas("army_books", [
  { method: "equal", attribute: "name", values: ["Battle Brothers"] },
  { method: "equal", attribute: "gameSystem", values: ["gf"] },
  { method: "limit", values: [1] },
])[0];
const catalogo = filas("army_units", [{ method: "equal", attribute: "bookKey", values: [libro.$id] }, { method: "limit", values: [200] }]);
const packages = new Map(
  filas("army_upgrade_packages", [{ method: "equal", attribute: "bookKey", values: [libro.$id] }, { method: "limit", values: [200] }])
    .map((p) => [`${libro.$id}:${p.packageUid}`, M.parseSections(p.sections)]),
);
console.log(`${libro.name} v${libro.versionString}`);

/** Lo que guardaria el constructor: elecciones, unidades resueltas y totales. */
function guardar(entries) {
  const built = M.buildArmy(entries, packages);
  return { guardadas: M.serializeEntries(entries), resueltas: built.units, puntos: built.points, miniaturas: built.modelCount };
}
const plan = (guardado) => M.planDeMigracion({ ...guardado, units: catalogo, packages, defaultBookKey: libro.$id });

// Una unidad con una seccion "afecta a todos" (una sola vez por opcion) y otra cualquiera.
const conTodos = catalogo.find((u) => M.sectionsForUnit(u, packages).some((s) => s.affects?.type === "all" && s.options?.length));
const otra = catalogo.find((u) => u !== conTodos && M.sectionsForUnit(u, packages).some((s) => s.options?.length));
const seccionTodos = M.sectionsForUnit(conTodos, packages).find((s) => s.affects?.type === "all" && s.options?.length);
const opcionTodos = seccionTodos.options[0];

console.log("\nLista que encaja con el libro");
const limpia = guardar([
  { key: "a", unit: conTodos, choices: { [M.optionId(opcionTodos)]: 1 } },
  { key: "b", unit: otra, choices: {} },
]);
const sinCambios = plan(limpia);
comprobar(sinCambios.pasos.length === 0, "no pide ningun cambio", sinCambios.pasos.map((p) => p.mensaje).join(" | "));
comprobar(
  sinCambios.despues.puntos === limpia.puntos && sinCambios.despues.unidades === 2,
  "y queda igual que estaba",
  `${sinCambios.antes.puntos} → ${sinCambios.despues.puntos} pts`,
);

console.log("\nLista montada con un libro que ya no es el actual");
const vieja = guardar([
  { key: "a", unit: conTodos, choices: { [M.optionId(opcionTodos)]: 1 } },
  { key: "b", unit: otra, choices: {} },
  { key: "c", unit: otra, choices: {} },
]);
// Lo que tendria guardado si el libro hubiera cambiado despues: una mejora y
// una unidad que ya no existen, una mejora "para todos" comprada tres veces,
// otra unidad unida a la retirada y un coste distinto del de ahora.
vieja.guardadas[0].choices = { [M.optionId(opcionTodos)]: 3, "opcion-retirada": 1 };
vieja.resueltas[0] = { ...vieja.resueltas[0], upgrades: [...vieja.resueltas[0].upgrades, "Arma Retirada"] };
vieja.guardadas.push({ bookKey: libro.$id, unitId: "unidad-retirada", choices: {} });
vieja.resueltas.push({ ...vieja.resueltas[1], name: "Escuadra Retirada", cost: 100 });
vieja.guardadas[2].attachedTo = 3;
vieja.resueltas[1] = { ...vieja.resueltas[1], cost: vieja.resueltas[1].cost + 15 };
vieja.puntos += 115;

const ajuste = plan(vieja);
const tipos = new Set(ajuste.pasos.map((p) => p.tipo));
for (const paso of ajuste.pasos) console.log(`    · [${paso.indice}] ${paso.mensaje}`);
comprobar(ajuste.pasos.some((p) => p.tipo === "unidad-retirada" && p.indice === 3), "pide quitar la unidad retirada");
comprobar(ajuste.pasos.some((p) => p.tipo === "union-perdida" && p.indice === 2), "avisa de la union que se pierde");
comprobar(
  ajuste.pasos.some((p) => p.tipo === "mejora-retirada" && p.mensaje.includes('"Arma Retirada"')),
  "nombra la mejora retirada",
);
comprobar(tipos.has("mejora-de-mas"), "pide bajar la mejora comprada de mas");
comprobar(ajuste.pasos.some((p) => p.tipo === "coste" && p.indice === 1), "dice que unidad cambia de coste");
comprobar(ajuste.entradas.length === 3, "quedan tres unidades", `${ajuste.antes.unidades} → ${ajuste.despues.unidades}`);
comprobar(
  JSON.stringify(ajuste.entradas[0].choices) === JSON.stringify({ [M.optionId(opcionTodos)]: 1 }),
  "las elecciones quedan dentro de lo que admite el libro",
  JSON.stringify(ajuste.entradas[0].choices),
);
comprobar(ajuste.entradas.every((e) => e.attachedTo === undefined), "y ninguna unida a la que ya no esta");
comprobar(ajuste.despues.puntos === limpia.puntos + otra.cost, "los puntos de despues son los de la lista ajustada", `${ajuste.antes.puntos} → ${ajuste.despues.puntos}`);
comprobar(plan(guardar(ajuste.entradas)).pasos.length === 0, "y una vez ajustada ya no pide nada mas");

console.log(`\nLista real de Army Forge (${LISTA_ANTIGUA})`);
const respuesta = await fetch(`https://army-forge.onepagerules.com/api/community-lists/${LISTA_ANTIGUA}`);
const raw = await respuesta.json();
// Es de Wolf Brothers, no del libro de arriba: va con su propio catalogo.
const suyo = filas("army_books", [
  { method: "equal", attribute: "uid", values: [raw.details.armyId] },
  { method: "equal", attribute: "gameSystem", values: ["gf"] },
  { method: "limit", values: [1] },
])[0];
const suyas = filas("army_units", [{ method: "equal", attribute: "bookKey", values: [suyo.$id] }, { method: "limit", values: [200] }]);
const susPaquetes = new Map(
  filas("army_upgrade_packages", [{ method: "equal", attribute: "bookKey", values: [suyo.$id] }, { method: "limit", values: [200] }])
    .map((p) => [`${suyo.$id}:${p.packageUid}`, M.parseSections(p.sections)]),
);
const desfasados = M.librosDesfasados(JSON.stringify({ raw }), [libro, suyo]);
comprobar(
  desfasados.length === 1 && desfasados[0].guardada === "3.4.4" && desfasados[0].actual === suyo.versionString,
  "se detecta montada con una version anterior",
  desfasados.map((d) => `${d.nombre} v${d.guardada} → v${d.actual}`).join(", "),
);
comprobar(
  M.librosDesfasados(JSON.stringify({ source: { books: [{ bookKey: suyo.$id, bookVersion: suyo.versionString }] } }), [suyo]).length === 0,
  "una lista guardada con la version actual no se marca",
);
const guardadas = M.storedEntriesFromForgeList(raw, new Map([[suyo.uid, suyo.$id]]));
comprobar(
  guardadas.length === raw.list.units.filter((u) => !u.joinToUnit).length,
  "se leen todas sus unidades, tambien las que ya no esten",
  `${guardadas.length}`,
);
const real = M.planDeMigracion({
  guardadas,
  resueltas: [],
  puntos: raw.details.listPoints,
  miniaturas: raw.list.modelCount,
  units: suyas,
  packages: susPaquetes,
});
for (const paso of real.pasos) console.log(`    · [${paso.indice}] ${paso.mensaje}`);
console.log(`    ${real.antes.puntos} → ${real.despues.puntos} pts · ${real.antes.unidades} → ${real.despues.unidades} unidades`);
comprobar(real.despues.unidades === guardadas.length, "sus unidades siguen en el libro actual");

await rm(dir, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} fallos.` : "\nTodo correcto.");
process.exit(fallos ? 1 : 0);
