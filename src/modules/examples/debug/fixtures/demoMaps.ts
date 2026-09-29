import type { Door, MapCell, MapDefinition } from "../../../maps/domain/map";

function cells(width: number, height: number, difficult: string[], impassable: string[]): MapCell[] {
  return Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const id = `${x},${y}`;
    return { id, x, y, terrain: impassable.includes(id) ? "impassable" : difficult.includes(id) ? "difficult" : "normal" };
  });
}

const passage: Door = {
  id: "crypt-passage",
  ends: [{ mapId: "entrance", cellId: "7,3" }, { mapId: "crypt", cellId: "0,3" }],
};

export const demoMaps: readonly MapDefinition[] = [
  {
    id: "entrance", name: "Sala de guardia", kind: "room", width: 8, height: 6,
    cells: cells(8, 6, ["3,2", "3,3", "4,3"], ["1,1", "1,4", "6,1", "6,4"]),
    doors: [passage],
    places: [{ id: "supplies", name: "Cofre de suministros", kind: "chest", cellId: "2,1" }],
  },
  {
    id: "crypt", name: "Cripta sumergida", kind: "room", width: 8, height: 6,
    cells: cells(8, 6, ["2,2", "3,2", "4,2", "2,3", "3,3", "4,3"], ["5,1", "5,2", "5,4"]),
    doors: [passage],
    places: [
      { id: "relic", name: "Cofre de la reliquia", kind: "chest", cellId: "6,1" },
      { id: "altar", name: "Altar antiguo", kind: "objective", cellId: "6,3" },
    ],
  },
  {
    id: "battlefield", name: "El paso del río", kind: "battlefield", width: 12, height: 8,
    cells: cells(12, 8, Array.from({ length: 8 }, (_, y) => `5,${y}`).filter(id => id !== "5,4"),
      ["2,2", "2,3", "3,2", "9,5", "9,6", "8,6"]),
    doors: [],
    places: [
      { id: "bridge", name: "Controlar el vado", kind: "objective", cellId: "5,4" },
      { id: "hill", name: "Tomar la colina", kind: "objective", cellId: "9,2" },
    ],
  },
];
