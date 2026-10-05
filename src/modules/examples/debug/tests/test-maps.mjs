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
const { createMapSession, updateMapSession, validateMaps, isCellBlocked, demoMaps, createMapDocument, paintMap, resizeMap, setMapStatus, loadMaps, saveMaps } = await import(
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
assert.deepEqual(resized.definition.wallDoors[0].cellIds, ["0,1"]);
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

const wall = hex.definition.cells.find(cell => cell.id === "1,0");
assert.equal(wall.terrain, "normal");
assert.equal(isCellBlocked(hex.definition, hex.state, wall), true);
assert.equal(paintMap(hex, "1,0", "difficult").definition.cells.find(cell => cell.id === "1,0").terrain, "difficult");
assert.throws(() => paintMap(hex, "1,0", "prop"), /recortado/);
const gate = paintMap(hex, "1,0", "exit", "", 3);
assert.deepEqual(gate.definition.wallDoors[0].cellIds, ["1,0", "2,0", "3,0"]);
assert.equal(isCellBlocked(gate.definition, gate.state, wall), true);
const openGate = { ...gate.state, openedDoorIds: [gate.definition.wallDoors[0].id] };
assert.equal(isCellBlocked(gate.definition, openGate, wall), false);
assert.equal(isCellBlocked(gate.definition, openGate, { ...wall, terrain: "impassable" }), true);
assert.throws(() => paintMap(gate, "2,0", "exit", "", 2), /superpuesta/);
assert.throws(() => paintMap(hex, "4,0", "exit", "", 2), /no cabe/);
assert.throws(() => paintMap(hex, "0,0", "exit", "", 0), /Ancho/);
assert.throws(() => paintMap(gate, "2,0", "impassable"), /Retira/);
assert.equal(paintMap(gate, "2,0", "erase").definition.wallDoors.length, 0);
assert.equal(resizeMap(gate, { ...settings, width: 2, height: 5 }).definition.wallDoors.length, 0);
saveMaps(storage, [gate]);
assert.deepEqual(loadMaps(storage), [gate]);
stored = JSON.stringify({ version: 1, maps: [{ ...hex, definition: { ...hex.definition,
  cells: hex.definition.cells.map(cell => cell.id === wall.id ? { ...cell, terrain: "impassable" } : cell) } }] });
assert.equal(loadMaps(storage)[0].definition.cells.find(cell => cell.id === wall.id).terrain, "normal");
const explicitTerrain = paintMap(hex, "1,0", "impassable");
saveMaps(storage, [explicitTerrain]);
assert.equal(loadMaps(storage)[0].definition.cells.find(cell => cell.id === wall.id).terrain, "impassable");
console.log("Muros y puertas: terreno independiente, ancho, cierre y migración correctos.");
