import { isClippedHex } from "../domain/hexBoundary";
import type { MapCell, MapDefinition, MapState, Terrain } from "../domain/map";
import "./maps.css";

export const terrainLabels: Record<Terrain, string> = {
  normal: "Normal", difficult: "Difícil", impassable: "Impasable",
};

/** Controlled board: the host owns selection, commands and session lifetime. */
export function MapBoard({ map, state, selectedCellId, onSelectCell }: {
  map: MapDefinition;
  state: MapState;
  selectedCellId?: string;
  onSelectCell: (cell: MapCell) => void;
}) {
  return (
    <div className="map-board-scroll">
      <div className={map.grid === "hex" ? "map-board map-board--hex" : "map-board"} role="group" aria-label={map.name}
        style={map.grid === "hex" ? { width: map.width * 60 - 30, height: map.height === 1 ? 33 : (map.height - 1) * 52 } : { gridTemplateColumns: `repeat(${map.width}, minmax(36px, 1fr))` }}>
        {[...map.cells].sort((a, b) => a.y - b.y || a.x - b.x).map(cell => {
          const clipped = isClippedHex(map, cell);
          const terrain = cell.terrain;
          const places = map.places.filter(place => place.cellId === cell.id);
          const wallDoor = map.wallDoors?.find(candidate => candidate.cellIds.includes(cell.id));
          const door = wallDoor?.id ?? map.doors.find(candidate => candidate.ends.some(end => end.mapId === map.id && end.cellId === cell.id))?.id ??
            (map.exits?.includes(cell.id) ? `exit:${cell.id}` : undefined);
          const doorOpen = door !== undefined && state.openedDoorIds.includes(door);
          return (
            <button key={cell.id} type="button"
              className={`map-cell map-cell--${terrain}${clipped ? " map-cell--wall" : ""}`}
              style={map.grid === "hex" ? { left: cell.x * 60 + (cell.y % 2) * 30 - 29, top: cell.y * 52 - 33 } : undefined}
              aria-pressed={selectedCellId === cell.id}
              aria-label={`Casilla ${cell.x + 1}, ${cell.y + 1}: ${terrainLabels[terrain]}${clipped ? ", muro recortado" : ""}${door ? (doorOpen ? ", puerta abierta" : ", puerta cerrada") : ""}${places.map(place => `, ${place.name}`).join("")}`}
              onClick={() => onSelectCell(cell)}>
              <span className="map-coordinate">{cell.x + 1},{cell.y + 1}</span>
              {door && <span className="map-door-marker" aria-hidden="true" style={clipped ? {
                left: cell.y % 2 === 0 && cell.x === 0 ? "75%" : cell.y % 2 !== 0 && cell.x === map.width - 1 ? "25%" : "50%",
                top: cell.y === 0 ? "75%" : cell.y === map.height - 1 ? "25%" : "50%",
              } : undefined}>{doorOpen ? "▯" : "▥"}</span>}
              {places.map(place => <span key={place.id} aria-hidden="true">{
                place.kind === "prop" ? "◆" : place.kind === "chest" ? (state.openedChestIds.includes(place.id) ? "□" : "▣") :
                  (state.claimedObjectiveIds.includes(place.id) ? "✓" : "⚑")
              }</span>)}
              {terrain === "impassable" && <span aria-hidden="true">×</span>}
              {terrain === "difficult" && places.length === 0 && !door && <span aria-hidden="true">≈</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
