import type { MapCell, MapDefinition } from "./map";

/** Odd-r rectangle: alternate half cells at the sides and half rows at the ends. */
export function isClippedHex(map: Pick<MapDefinition, "grid" | "width" | "height">, cell: Pick<MapCell, "x" | "y">): boolean {
  return map.grid === "hex" && (cell.y === 0 || cell.y === map.height - 1 ||
    (cell.y % 2 === 0 ? cell.x === 0 : cell.x === map.width - 1));
}

/** Makes clipped cells walls and removes items that can no longer occupy them. */
export function alignHexBoundary(map: MapDefinition): MapDefinition {
  if (map.grid !== "hex") return map;
  const clipped = new Set(map.cells.filter(cell => isClippedHex(map, cell)).map(cell => cell.id));
  return { ...map,
    cells: map.cells.map(cell => clipped.has(cell.id) ? { ...cell, terrain: "impassable" } : cell),
    places: map.places.filter(place => !clipped.has(place.cellId)),
    exits: map.exits?.filter(id => !clipped.has(id)),
  };
}
