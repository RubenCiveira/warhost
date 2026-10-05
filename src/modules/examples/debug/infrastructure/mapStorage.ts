import { alignHexBoundary, isClippedHex } from "../../../maps/domain/hexBoundary";
import { validateMaps } from "../../../maps/domain/map";
import type { MapDocument } from "../domain/mapDocument";

export const MAP_STORAGE_KEY = "warhost:maps:v1";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function isDocument(value: unknown): value is MapDocument {
  if (!record(value) || !record(value.definition) || !record(value.state)) return false;
  const map = value.definition;
  return (value.status === "draft" || value.status === "configured") &&
    typeof map.id === "string" && typeof map.name === "string" && map.name.trim().length > 0 &&
    typeof map.width === "number" && map.width <= 40 && typeof map.height === "number" && map.height <= 40 &&
    ["room", "corridor", "battlefield"].includes(String(map.kind)) &&
    (map.grid === undefined || map.grid === "square" || map.grid === "hex") &&
    (map.exits === undefined || strings(map.exits)) &&
    (map.wallDoors === undefined || (Array.isArray(map.wallDoors) && map.wallDoors.every(door =>
      record(door) && typeof door.id === "string" && strings(door.cellIds)))) &&
    (value.state.openedDoorIds === undefined || strings(value.state.openedDoorIds)) &&
    Array.isArray(map.cells) && map.cells.every(cell => record(cell) && typeof cell.id === "string" &&
      typeof cell.x === "number" && typeof cell.y === "number" && ["normal", "difficult", "impassable"].includes(String(cell.terrain))) &&
    Array.isArray(map.places) && map.places.every(place => record(place) && typeof place.id === "string" &&
      typeof place.cellId === "string" && typeof place.name === "string" && ["chest", "objective", "prop"].includes(String(place.kind))) &&
    Array.isArray(map.doors) && map.doors.every(door => record(door) && typeof door.id === "string" &&
      Array.isArray(door.ends) && door.ends.length === 2 && door.ends.every(end => record(end) &&
        typeof end.mapId === "string" && typeof end.cellId === "string")) &&
    typeof value.state.trapsSearched === "boolean" && strings(value.state.openedChestIds) && strings(value.state.claimedObjectiveIds);
}

/** Reads a versioned collection. Invalid data is reported, never overwritten. */
export function loadMaps(storage: Pick<Storage, "getItem">): MapDocument[] | null {
  const raw = storage.getItem(MAP_STORAGE_KEY);
  if (raw === null) return null;
  const data: unknown = JSON.parse(raw);
  if (!record(data) || (data.version !== 1 && data.version !== 2) || !Array.isArray(data.maps) || !data.maps.every(isDocument)) {
    throw new Error("Los mapas guardados tienen un formato incompatible.");
  }
  const maps = data.maps.map(document => {
    const definition = alignHexBoundary(data.version === 1 ? {
      ...document.definition,
      cells: document.definition.cells.map(cell => isClippedHex(document.definition, cell) ? { ...cell, terrain: "normal" } : cell),
    } : document.definition);
    return { ...document, definition, state: {
      ...document.state,
      openedDoorIds: document.state.openedDoorIds ?? [],
      openedChestIds: document.state.openedChestIds.filter(id => definition.places.some(place => place.id === id)),
      claimedObjectiveIds: document.state.claimedObjectiveIds.filter(id => definition.places.some(place => place.id === id)),
    } };
  });
  validateMaps(maps.map(document => document.definition));
  return maps;
}

/** Saves synchronously so callers can surface quota or permission failures. */
export function saveMaps(storage: Pick<Storage, "setItem">, maps: readonly MapDocument[]): void {
  validateMaps(maps.map(document => document.definition));
  storage.setItem(MAP_STORAGE_KEY, JSON.stringify({ version: 2, maps }));
}
