import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const result = await build({
  stdin: {
    contents: 'export * from "../../maps/domain/map"; export * from "./domain/mapDocument"; export * from "./infrastructure/mapStorage"; export * from "../../maps/application/mapSession"; export * from "./fixtures/demoMaps";',
    resolveDir: fileURLToPath(new URL("../", import.meta.url)),
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { createMapSession, updateMapSession, validateMaps, demoMaps, createMapDocument, paintMap, resizeMap, setMapStatus, loadMaps, saveMaps } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);

const initial = createMapSession(demoMaps);
const searched = updateMapSession(demoMaps, initial, "entrance", { type: "search-traps" });
assert.deepEqual([initial.entrance.trapsSearched, searched.entrance.trapsSearched, searched.crypt.trapsSearched], [false, true, false]);

const opened = updateMapSession(demoMaps, searched, "entrance", { type: "open-chest", placeId: "supplies" });
assert.deepEqual(opened.entrance.openedChestIds, ["supplies"]);
assert.strictEqual(updateMapSession(demoMaps, opened, "entrance", { type: "open-chest", placeId: "supplies" }).entrance, opened.entrance);
assert.throws(() => updateMapSession(demoMaps, opened, "crypt", { type: "open-chest", placeId: "supplies" }));
assert.throws(() => updateMapSession(demoMaps, opened, "battlefield", { type: "search-traps" }));
assert.throws(() => updateMapSession(demoMaps, opened, "missing", { type: "reset" }));
assert.throws(() => updateMapSession(demoMaps, opened, "crypt", { type: "open-chest", placeId: "altar" }));

const claimed = updateMapSession(demoMaps, opened, "crypt", { type: "claim-objective", placeId: "altar" });
assert.deepEqual(claimed.crypt.claimedObjectiveIds, ["altar"]);
assert.strictEqual(updateMapSession(demoMaps, claimed, "crypt", { type: "claim-objective", placeId: "altar" }).crypt, claimed.crypt);
const reset = updateMapSession(demoMaps, claimed, "entrance", { type: "reset" });
assert.deepEqual(reset.entrance, initial.entrance);
assert.strictEqual(reset.crypt, claimed.crypt);

assert.throws(() => validateMaps([demoMaps[0], demoMaps[0]]));
assert.throws(() => validateMaps([demoMaps[0], { ...demoMaps[1], doors: [] }]));
assert.throws(() => validateMaps([{ ...demoMaps[2], doors: demoMaps[0].doors }]));
assert.throws(() => validateMaps([{ ...demoMaps[2], cells: demoMaps[2].cells.slice(1) }]));
assert.throws(() => validateMaps([{ ...demoMaps[2], places: [{ id: "bad", name: "Bad", kind: "chest", cellId: "2,2" }] }]));
assert.throws(() => validateMaps([demoMaps[0], { ...demoMaps[1], cells: demoMaps[1].cells.map(cell => cell.id === "0,3" ? { ...cell, terrain: "impassable" } : cell) }]));
console.log("Mapas: estado aislado, acciones, reinicio, geometría y puertas correctos.");

const settings = { name: "Pasillo", width: 4, height: 3, grid: "hex", kind: "corridor" };
const draft = createMapDocument("custom", settings);
assert.equal(draft.definition.cells.length, 12);
assert.equal(draft.status, "draft");
assert.throws(() => createMapDocument("bad", { ...settings, width: 0 }));
assert.throws(() => createMapDocument("bad", { ...settings, height: 41 }));
assert.throws(() => createMapDocument("bad", { ...settings, name: " " }));
const terrain = paintMap(draft, "1,1", "difficult");
assert.equal(terrain.definition.cells.find(cell => cell.id === "1,1").terrain, "difficult");
assert.equal(draft.definition.cells.find(cell => cell.id === "1,1").terrain, "normal");
assert.throws(() => paintMap(draft, "1,1", "exit"));
assert.throws(() => paintMap(createMapDocument("open", { ...settings, kind: "battlefield" }), "0,0", "exit"));
const decorated = paintMap(paintMap(terrain, "0,1", "exit"), "2,1", "prop", "Estatua");
assert.throws(() => paintMap(decorated, "2,1", "impassable"));
const configured = setMapStatus(decorated, "configured", [decorated.definition]);
assert.throws(() => paintMap(configured, "0,0", "normal"));
const resized = resizeMap(decorated, { ...settings, width: 2 });
assert.equal(resized.definition.places.length, 0);
assert.deepEqual(resized.definition.exits, ["0,1"]);
assert.equal(paintMap(decorated, "2,1", "erase").definition.places.length, 0);
let stored = null;
const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
assert.equal(loadMaps(storage), null);
saveMaps(storage, [configured]);
assert.deepEqual(loadMaps(storage), [configured]);
stored = '{"version":1,"maps":[{}]}';
assert.throws(() => loadMaps(storage));
stored = '{"version":9,"maps":[]}';
assert.throws(() => loadMaps(storage));
assert.throws(() => saveMaps({ setItem: () => { throw new Error("Quota"); } }, [draft]), /Quota/);
console.log("Editor: terreno, atrezo, salidas, tamaños, bloqueo y persistencia correctos.");
const hex = createMapDocument("hex-wall", { ...settings, width: 5, height: 5, grid: "hex" });
assert.deepEqual(hex.definition.cells.filter(cell => cell.terrain === "impassable").map(cell => cell.id),
  ["0,0", "1,0", "2,0", "3,0", "4,0", "4,1", "0,2", "4,3", "0,4", "1,4", "2,4", "3,4", "4,4"]);
assert.throws(() => paintMap(hex, "0,2", "normal"), /recortado/);
assert.throws(() => paintMap(hex, "4,1", "exit"), /recortado/);
assert.throws(() => paintMap(hex, "1,0", "prop"), /recortado/);
const invalidWall = { ...hex.definition, cells: hex.definition.cells.map(cell => ({ ...cell, terrain: "normal" })) };
assert.throws(() => validateMaps([invalidWall]), /recortados/);
stored = JSON.stringify({ version: 1, maps: [{ ...hex, definition: invalidWall }] });
assert.deepEqual(loadMaps(storage)[0].definition.cells, hex.definition.cells);
const wider = resizeMap(hex, { ...settings, width: 6, height: 5, grid: "hex" });
assert.equal(wider.definition.cells.find(cell => cell.id === "5,1").terrain, "impassable");
console.log("Hexágonos: borde recortado, bloqueo y migración correctos.");
