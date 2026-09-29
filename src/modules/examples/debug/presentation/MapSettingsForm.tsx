import { useState } from "react";
import type { MapSettings } from "../domain/mapDocument";

export const kindLabels = { room: "Sala", corridor: "Pasillo", battlefield: "Lugar abierto" };

/** Shared form for initial creation and draft dimensions. */
export function MapSettingsForm({ initial, submitLabel, onSubmit }: {
  initial: MapSettings;
  submitLabel: string;
  onSubmit: (settings: MapSettings) => void;
}) {
  const [settings, setSettings] = useState(initial);
  return <form className="map-settings" onSubmit={event => { event.preventDefault(); onSubmit(settings); }}>
    <label>Nombre<input required maxLength={100} value={settings.name} onChange={event => setSettings({ ...settings, name: event.target.value })} /></label>
    <label>Tipo de lugar<select aria-label="Tipo de lugar" value={settings.kind} onChange={event => setSettings({ ...settings, kind: event.target.value as MapSettings["kind"] })}>
      {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Cuadrícula<select aria-label="Cuadrícula" value={settings.grid} onChange={event => setSettings({ ...settings, grid: event.target.value as MapSettings["grid"] })}>
      <option value="square">Cuadrados</option><option value="hex">Hexágonos</option>
    </select></label>
    <label>Columnas<input type="number" min={1} max={40} required value={settings.width} onChange={event => setSettings({ ...settings, width: Number(event.target.value) })} /></label>
    <label>Filas<input type="number" min={1} max={40} required value={settings.height} onChange={event => setSettings({ ...settings, height: Number(event.target.value) })} /></label>
    <button type="submit">{submitLabel}</button>
  </form>;
}
