import { applyMapAction, createMapState, validateMaps } from "../domain/map";
import type { MapAction, MapDefinition, MapState } from "../domain/map";

export type MapSession = Readonly<Record<string, MapState>>;

/** Starts an exploration session with independent state per map. */
export function createMapSession(maps: readonly MapDefinition[]): MapSession {
  validateMaps(maps);
  return Object.fromEntries(maps.map(map => [map.id, createMapState()]));
}

/** Dispatches a command to one map, preserving all other map states. */
export function updateMapSession(
  maps: readonly MapDefinition[], session: MapSession, mapId: string, action: MapAction,
): MapSession {
  const map = maps.find(candidate => candidate.id === mapId);
  if (!map || !Object.hasOwn(session, mapId)) throw new Error("Mapa desconocido.");
  return { ...session, [mapId]: applyMapAction(map, session[mapId], action) };
}
