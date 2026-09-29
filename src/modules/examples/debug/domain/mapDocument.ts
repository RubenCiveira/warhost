import { alignHexBoundary, isClippedHex } from "../../../maps/domain/hexBoundary";
import { createMapState, validateMaps } from "../../../maps/domain/map";
import type { MapDefinition, MapState, Terrain } from "../../../maps/domain/map";

export type MapDocument = Readonly<{
  definition: MapDefinition;
  status: "draft" | "configured";
  state: MapState;
}>;

export type MapSettings = {
  name: string;
  width: number;
  height: number;
  grid: "square" | "hex";
  kind: MapDefinition["kind"];
};

export type MapTool = Terrain | "chest" | "objective" | "prop" | "exit" | "erase";

/** Creates an editable map. Dimensions count cells, including on a hex grid. */
export function createMapDocument(id: string, settings: MapSettings): MapDocument {
  if (!settings.name.trim()) throw new Error("Indica un nombre para el mapa.");
  if (![settings.width, settings.height].every(value => Number.isInteger(value) && value >= 1 && value <= 40)) {
    throw new Error("El tamaño debe estar entre 1 y 40 casillas por lado.");
  }
  return {
    definition: alignHexBoundary({
      ...settings, id, name: settings.name.trim(), doors: [], places: [], exits: [],
      cells: Array.from({ length: settings.width * settings.height }, (_, index) => ({
        id: `${index % settings.width},${Math.floor(index / settings.width)}`,
        x: index % settings.width, y: Math.floor(index / settings.width), terrain: "normal",
      })),
    }),
    status: "draft", state: createMapState(),
  };
}

/** Applies one editor stroke; configured maps cannot be modified. */
export function paintMap(document: MapDocument, cellId: string, tool: MapTool, propName = "Atrezo"): MapDocument {
  if (document.status !== "draft") throw new Error("Vuelve al borrador para editar el mapa.");
  const map = document.definition;
  const cell = map.cells.find(candidate => candidate.id === cellId);
  if (!cell) throw new Error("Casilla desconocida.");
  if (isClippedHex(map, cell) && tool !== "erase" && tool !== "impassable") {
    throw new Error("Este hexágono está recortado por el muro y es impasable.");
  }
  let definition = map;
  if (tool === "normal" || tool === "difficult" || tool === "impassable") {
    if (tool === "impassable" && (map.places.some(place => place.cellId === cellId) ||
        map.exits?.includes(cellId) || map.doors.some(door => door.ends.some(end => end.mapId === map.id && end.cellId === cellId)))) {
      throw new Error("Retira los elementos de la casilla antes de hacerla impasable.");
    }
    definition = { ...map, cells: map.cells.map(candidate => candidate.id === cellId ? { ...candidate, terrain: tool } : candidate) };
  } else if (tool === "erase") {
    definition = { ...map, places: map.places.filter(place => place.cellId !== cellId), exits: map.exits?.filter(id => id !== cellId) };
  } else {
    if (cell.terrain === "impassable") throw new Error("Elige una casilla transitable.");
    if (tool === "exit") {
      if (map.kind === "battlefield") throw new Error("Los lugares abiertos no tienen puertas de salida.");
      if (cell.x !== 0 && cell.y !== 0 && cell.x !== map.width - 1 && cell.y !== map.height - 1) {
        throw new Error("Coloca la salida en el borde del mapa.");
      }
      definition = { ...map, exits: [...new Set([...(map.exits ?? []), cellId])] };
    } else {
      if (tool === "prop" && !propName.trim()) throw new Error("Indica el nombre del atrezo.");
      definition = { ...map, places: [
        ...map.places.filter(place => place.cellId !== cellId),
        { id: `place:${cellId}`, cellId, kind: tool, name: tool === "prop" ? propName.trim() : tool === "chest" ? "Cofre" : "Zona objetivo" },
      ] };
    }
  }
  return { ...document, definition, state: {
    ...document.state,
    openedChestIds: document.state.openedChestIds.filter(id => definition.places.some(place => place.id === id && place.kind === "chest")),
    claimedObjectiveIds: document.state.claimedObjectiveIds.filter(id => definition.places.some(place => place.id === id && place.kind === "objective")),
  } };
}

/** Changes geometry while retaining cells and elements that still fit. */
export function resizeMap(document: MapDocument, settings: MapSettings): MapDocument {
  if (document.status !== "draft") throw new Error("Vuelve al borrador para editar el mapa.");
  const resized = createMapDocument(document.definition.id, settings);
  if (document.definition.doors.length) throw new Error("No se puede redimensionar un mapa con conexiones entre salas.");
  const places = document.definition.places.filter(place => resized.definition.cells.some(cell => cell.id === place.cellId && !isClippedHex(resized.definition, cell)));
  return {
    ...document,
    state: { ...document.state,
      openedChestIds: document.state.openedChestIds.filter(id => places.some(place => place.id === id)),
      claimedObjectiveIds: document.state.claimedObjectiveIds.filter(id => places.some(place => place.id === id)),
    },
    definition: alignHexBoundary({
      ...resized.definition,
      cells: resized.definition.cells.map(cell => document.definition.cells.find(previous => previous.id === cell.id) ?? cell),
      places,
      exits: settings.kind === "battlefield" ? [] : (document.definition.exits ?? []).filter(id => resized.definition.cells.some(cell =>
        cell.id === id && (cell.x === 0 || cell.y === 0 || cell.x === settings.width - 1 || cell.y === settings.height - 1))),
    }),
  };
}

/** Validates a completed design. Reopening preserves the design and exploration. */
export function setMapStatus(document: MapDocument, status: MapDocument["status"], maps: readonly MapDefinition[]): MapDocument {
  if (status === "configured") {
    validateMaps(maps);
    if (!document.definition.cells.some(cell => cell.terrain !== "impassable")) throw new Error("El mapa necesita al menos una casilla transitable.");
  }
  return { ...document, status };
}
