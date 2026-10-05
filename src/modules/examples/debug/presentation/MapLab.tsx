import { useState } from "react";
import "./debug.css";
import { applyMapAction, createMapState, isClippedHex, MapBoard, terrainLabels } from "../../../maps";
import { createMapDocument, paintMap, resizeMap, setMapStatus } from "../domain/mapDocument";
import type { MapDocument, MapTool } from "../domain/mapDocument";
import { loadMaps, saveMaps } from "../infrastructure/mapStorage";
import { kindLabels, MapSettingsForm } from "./MapSettingsForm";
import { demoMaps } from "../fixtures/demoMaps";

export default function MapLab() {
  const [loaded] = useState(() => {
    try {
      return { maps: loadMaps(window.localStorage) ?? demoMaps.map(definition => ({
        definition, status: "configured" as const, state: createMapState(),
      })), error: "" };
    } catch {
      return { maps: [], error: "No se han podido leer los mapas guardados. Comprueba el almacenamiento del navegador y recarga. No se sobrescribirán los datos." };
    }
  });
  const [documents, setDocuments] = useState<MapDocument[]>(loaded.maps);
  const [mapId, setMapId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [selectedCellId, setSelectedCellId] = useState<string>();
  const [tool, setTool] = useState<MapTool | "inspect">("inspect");
  const [doorWidth, setDoorWidth] = useState(1);
  const [propName, setPropName] = useState("Barril");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const document = documents.find(candidate => candidate.definition.id === mapId);
  const map = document?.definition;
  const cell = map?.cells.find(candidate => candidate.id === selectedCellId);

  const commit = (next: MapDocument[]) => {
    saveMaps(window.localStorage, next);
    setDocuments(next);
    setSaved(true);
  };
  const attempt = (action: () => void) => {
    try { action(); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido guardar el cambio."); }
  };
  const update = (next: MapDocument) => commit(documents.map(candidate => candidate.definition.id === next.definition.id ? next : candidate));
  const selectMap = (id?: string, cellId?: string) => {
    setMapId(id); setSelectedCellId(cellId); setTool("inspect"); setError(""); setCreating(false);
  };

  return <div className="map-lab">
    <header className="map-lab-heading">
      <h1>{map ? map.name : "Mapas de prueba"}</h1>
      <p>Crea salas, pasillos y lugares abiertos. Diseña el terreno y prepara el escenario.</p>
    </header>
    <p className="map-muted" role="status">{saved ? "Cambios guardados en este navegador." : "Guardado local en este navegador; no se sincroniza con otros dispositivos."}</p>
    {(loaded.error || error) && <p role="alert" className="map-error">{loaded.error || error}</p>}
    {!loaded.error && <>
      {!map && !creating && <>
        <div className="map-lab-tabs"><button type="button" onClick={() => setCreating(true)}>Crear mapa</button></div>
        <div className="map-list">
          {documents.map(item => <article key={item.definition.id}>
            <div><h2>{item.definition.name}</h2>
              <p>{kindLabels[item.definition.kind]} · {item.definition.width} × {item.definition.height} · {item.definition.grid === "hex" ? "Hexágonos" : "Cuadrados"}</p>
              <strong>{item.status === "draft" ? "Borrador" : "Configurado"}</strong>
            </div>
            <button type="button" onClick={() => selectMap(item.definition.id)}>Abrir {item.definition.name}</button>
          </article>)}
        </div>
      </>}
      {creating && <>
        <div className="map-lab-tabs"><button type="button" onClick={() => setCreating(false)}>Volver al listado</button></div>
        <h2>Crear mapa</h2>
        <MapSettingsForm initial={{ name: "", width: 8, height: 6, kind: "room", grid: "square" }} submitLabel="Crear borrador"
          onSubmit={settings => attempt(() => {
            const next = createMapDocument(crypto.randomUUID(), settings);
            commit([...documents, next]); selectMap(next.definition.id); setTool("normal");
          })} />
      </>}
      {document && map && <>
        <div className="map-lab-tabs">
          <button type="button" onClick={() => selectMap()}>Volver al listado</button>
          <strong>{document.status === "draft" ? "Borrador" : "Configurado"} · {kindLabels[map.kind]} · {map.width} × {map.height}</strong>
          <button type="button" onClick={() => attempt(() => {
            update(setMapStatus(document, document.status === "draft" ? "configured" : "draft", documents.map(item => item.definition)));
            setTool("inspect");
          })}>{document.status === "draft" ? "Marcar como configurado" : "Volver a editar"}</button>
        </div>
        <div className="map-lab-layout">
          <section aria-label="Tablero">
            <p>{document.status === "draft" ? "Elige una herramienta y pulsa las casillas para aplicarla." : "Diseño bloqueado. Selecciona una casilla para explorar."}</p>
            {map.grid === "hex" && <p className="map-muted">El borde se recorta para unir mapas. El muro bloquea los hexágonos partidos, salvo cuando una puerta se abra; el tamaño incluye esas casillas.</p>}
            <MapBoard map={map} state={document.state} selectedCellId={selectedCellId} onSelectCell={selected => {
              setSelectedCellId(selected.id);
              if (document.status === "draft" && tool !== "inspect") attempt(() => update(paintMap(document, selected.id, tool, propName, doorWidth)));
            }} />
            <div className="map-legend"><span>≈ Difícil</span><span>× Impasable</span><span>◆ Atrezo</span><span>▯ Salida</span><span>▣ Cofre</span><span>⚑ Objetivo</span></div>
          </section>
          <aside className="map-lab-sidebar">
            {document.status === "draft" && <>
              <section>
                <h2>Herramientas</h2>
                <label>Herramienta<select aria-label="Herramienta" value={tool} onChange={event => setTool(event.target.value as MapTool | "inspect")}>
                  <option value="inspect">Inspeccionar</option>
                  <option value="normal">Terreno normal</option><option value="difficult">Terreno difícil</option><option value="impassable">Terreno impasable</option>
                  <option value="prop">Añadir atrezo</option><option value="chest">Añadir cofre</option><option value="objective">Zona objetivo</option>
                  {map.kind !== "battlefield" && <option value="exit">Puerta de salida</option>}
                  <option value="erase">Retirar atrezo y salida</option>
                </select></label>
                {tool === "prop" && <label>Nombre del atrezo<input maxLength={100} value={propName} onChange={event => setPropName(event.target.value)} /></label>}
                {tool === "exit" && <>
                  <label>Ancho de puerta<input type="number" min={1} max={40} value={doorWidth} onChange={event => setDoorWidth(Number(event.target.value))} /></label>
                  <p>Coloca puertas en el muro, incluso en hexágonos partidos. El ancho se extiende a la derecha o hacia abajo; en las esquinas, a la derecha.</p>
                  <p>Se crean cerradas. Más adelante las abrirán las miniaturas para revelar el mapa de destino.</p>
                </>}
                <p className="map-muted">Un elemento de atrezo por casilla. Colocar otro lo sustituye. El terreno se cambia por separado.</p>
              </section>
              {!map.doors.length && <section>
                <details><summary>Tamaño y tipo de mapa</summary>
                  <p>Al reducir el tamaño se retirarán los elementos que queden fuera. Cambiar a lugar abierto retira las salidas.</p>
                  <MapSettingsForm key={JSON.stringify([map.width, map.height, map.kind, map.grid, map.name])}
                    initial={{ name: map.name, width: map.width, height: map.height, kind: map.kind, grid: map.grid ?? "square" }}
                    submitLabel="Aplicar configuración" onSubmit={settings => {
                      if ((settings.width < map.width || settings.height < map.height || (settings.kind === "battlefield" && (map.exits?.length || map.wallDoors?.length))) &&
                          !window.confirm("Este cambio puede retirar casillas, atrezo y salidas. ¿Continuar?")) return;
                      attempt(() => { update(resizeMap(document, settings)); setSelectedCellId(undefined); setTool("inspect"); });
                    }} />
                </details>
              </section>}
            </>}
            <section>
              <h2>{cell ? `Casilla ${cell.x + 1}, ${cell.y + 1}` : "Inspección"}</h2>
              {!cell && <p>Selecciona una casilla del tablero.</p>}
              {cell && <>
                <p>Terreno: {terrainLabels[cell.terrain]}.</p>
                {isClippedHex(map, cell) && <p>El muro recorta y bloquea esta casilla, independientemente de su terreno.</p>}
                {map.wallDoors?.filter(door => door.cellIds.includes(cell.id)).map(door => <p key={door.id}>Puerta cerrada · {door.cellIds.length} casillas de ancho. Apertura con miniaturas pendiente.</p>)}
                {map.exits?.includes(cell.id) && <p>Puerta cerrada sin destino asignado. Apertura con miniaturas pendiente.</p>}
                {map.places.filter(place => place.cellId === cell.id).map(place => <div key={place.id}>
                  <strong>{place.name}</strong>
                  {document.status === "configured" && place.kind !== "prop" && <button type="button"
                    disabled={place.kind === "chest" ? document.state.openedChestIds.includes(place.id) : document.state.claimedObjectiveIds.includes(place.id)}
                    onClick={() => attempt(() => update({ ...document, state: applyMapAction(map, document.state, {
                      type: place.kind === "chest" ? "open-chest" : "claim-objective", placeId: place.id,
                    }) }))}>{place.kind === "chest" ? "Abrir cofre" : "Controlar objetivo"}</button>}
                </div>)}
                {document.status === "configured" && map.doors.filter(door => door.ends.some(end => end.mapId === map.id && end.cellId === cell.id)).map(door => {
                  return <p key={door.id}>Puerta cerrada. El mapa de destino se revelará cuando una miniatura la abra.</p>;
                })}
              </>}
            </section>
            {document.status === "configured" && <section>
              <h2>Exploración</h2>
              {map.kind === "room" && <>
                <p>{document.state.trapsSearched ? "Búsqueda de trampas realizada." : "Aún no se han buscado trampas."}</p>
                <button type="button" disabled={document.state.trapsSearched} onClick={() => attempt(() => update({
                  ...document, state: applyMapAction(map, document.state, { type: "search-traps" }),
                }))}>Buscar trampas</button>
              </>}
              <p>Cofres abiertos: {document.state.openedChestIds.length}</p>
              <p>Objetivos controlados: {document.state.claimedObjectiveIds.length}</p>
              <button type="button" onClick={() => attempt(() => update({ ...document, state: createMapState() }))}>Reiniciar exploración</button>
            </section>}
          </aside>
        </div>
      </>}
    </>}
  </div>;
}
