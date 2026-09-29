import { isClippedHex } from "./hexBoundary";

export type Terrain = "normal" | "difficult" | "impassable";

export type MapCell = Readonly<{
  id: string;
  x: number;
  y: number;
  terrain: Terrain;
}>;

export type MapPlace = Readonly<{
  id: string;
  cellId: string;
  name: string;
  kind: "chest" | "objective" | "prop";
}>;

/** Static map definition. Runtime exploration belongs to MapState. */
export type MapDefinition = Readonly<{
  id: string;
  name: string;
  width: number;
  height: number;
  cells: readonly MapCell[];
  places: readonly MapPlace[];
  grid?: "square" | "hex";
  exits?: readonly string[];
}> & (
  | { readonly kind: "room" | "corridor"; readonly doors: readonly Door[] }
  | { readonly kind: "battlefield"; readonly doors: readonly [] }
);

/** One shared connection between two rooms, with a cell at either end. */
export type Door = Readonly<{
  id: string;
  ends: readonly [
    Readonly<{ mapId: string; cellId: string }>,
    Readonly<{ mapId: string; cellId: string }>,
  ];
}>;

export type MapState = Readonly<{
  trapsSearched: boolean;
  openedChestIds: readonly string[];
  claimedObjectiveIds: readonly string[];
}>;

/** Creates a fresh state for one map instance. */
export function createMapState(): MapState {
  return { trapsSearched: false, openedChestIds: [], claimedObjectiveIds: [] };
}

export type MapAction =
  | { type: "search-traps" }
  | { type: "open-chest"; placeId: string }
  | { type: "claim-objective"; placeId: string }
  | { type: "reset" };

/** Applies exploration rules without mutating the definition or previous state. */
export function applyMapAction(map: MapDefinition, state: MapState, action: MapAction): MapState {
  if (action.type === "reset") return createMapState();
  if (action.type === "search-traps") {
    if (map.kind !== "room") throw new Error("Solo se buscan trampas en salas.");
    return { ...state, trapsSearched: true };
  }
  const place = map.places.find(candidate => candidate.id === action.placeId);
  if (!place || place.kind !== (action.type === "open-chest" ? "chest" : "objective")) {
    throw new Error("El lugar no admite esta acción.");
  }
  if (action.type === "open-chest") {
    return state.openedChestIds.includes(place.id) ? state : {
      ...state, openedChestIds: [...state.openedChestIds, place.id],
    };
  }
  return state.claimedObjectiveIds.includes(place.id) ? state : {
    ...state, claimedObjectiveIds: [...state.claimedObjectiveIds, place.id],
  };
}

/** Validates map identities, geometry and reciprocal room connections. */
export function validateMaps(maps: readonly MapDefinition[]): void {
  if (new Set(maps.map(map => map.id)).size !== maps.length) throw new Error("Mapas duplicados.");
  for (const map of maps) {
    if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 1 || map.height < 1) {
      throw new Error("Dimensiones inválidas.");
    }
    if (map.cells.length !== map.width * map.height ||
        new Set(map.cells.map(cell => cell.id)).size !== map.cells.length ||
        new Set(map.cells.map(cell => `${cell.x},${cell.y}`)).size !== map.cells.length ||
        map.cells.some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.y) ||
          cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height)) {
      throw new Error("Cuadrícula inválida.");
    }
    if (map.cells.some(cell => isClippedHex(map, cell) && cell.terrain !== "impassable")) {
      throw new Error("Los hexágonos recortados del muro deben ser impasables.");
    }
    if (new Set(map.places.map(place => place.id)).size !== map.places.length ||
        map.places.some(place => !map.cells.some(cell => cell.id === place.cellId && cell.terrain !== "impassable"))) {
      throw new Error("Lugares inválidos.");
    }
    if (map.kind === "battlefield" && (map.doors.length || map.exits?.length)) throw new Error("Un campo de batalla no tiene puertas.");
    if (map.exits && (new Set(map.exits).size !== map.exits.length || map.exits.some(id =>
      !map.cells.some(cell => cell.id === id && cell.terrain !== "impassable" &&
        (cell.x === 0 || cell.y === 0 || cell.x === map.width - 1 || cell.y === map.height - 1))))) {
      throw new Error("Las salidas deben estar en casillas transitables del borde.");
    }
    if (new Set(map.doors.map(door => door.id)).size !== map.doors.length) throw new Error("Puertas duplicadas.");
    for (const door of map.doors) {
      if (door.ends[0].mapId === door.ends[1].mapId || !door.ends.some(end => end.mapId === map.id)) {
        throw new Error("Conexión inválida.");
      }
      for (const end of door.ends) {
        const room = maps.find(candidate => candidate.id === end.mapId);
        if (!room || room.kind === "battlefield" ||
            !room.cells.some(cell => cell.id === end.cellId && cell.terrain !== "impassable") ||
            !room.doors.some(candidate => candidate.id === door.id &&
              door.ends.every(endpoint => candidate.ends.some(other =>
                other.mapId === endpoint.mapId && other.cellId === endpoint.cellId)))) {
          throw new Error("La puerta debe conectar dos salas transitables de forma recíproca.");
        }
      }
    }
  }
}
