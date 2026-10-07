import type { LibroDesfasado } from "../lib/armyPayload";
import type { Migracion } from "@rubenciveira/opr-kit/core/migracion";

/**
 * El aviso de que la lista se monto con otra version del libro, o de que hay
 * cosas que el libro actual ya no admite, junto con lo que habria que hacer
 * para ajustarla y como queda despues. No cambia nada por si solo: ajustar es
 * guardar en el borrador lo que propone `migracion`, y de ahi no sale hasta
 * que se pulsa Guardar.
 *
 * Los cambios de coste no son errores, asi que por si solos no lo enseñan:
 * una lista importada calcula el coste por unidad algo distinto que el
 * constructor, y avisar por eso marcaria listas que estan bien.
 */
export default function AvisoMigracion({
  desfasados,
  migracion,
  editable,
  busy,
  onAjustar,
}: {
  desfasados: LibroDesfasado[];
  migracion: Migracion | null;
  editable: boolean;
  busy: boolean;
  onAjustar: () => void;
}) {
  const pasos = migracion?.pasos ?? [];
  const hayErrores = pasos.some((paso) => paso.tipo !== "coste");
  if (desfasados.length === 0 && !hayErrores) return null;

  return (
    <div className="banner aviso-migracion">
      <p className="aviso-migracion-titulo">
        {desfasados.length > 0
          ? `Libro actualizado: ${desfasados
              .map((libro) => `${libro.nombre} v${libro.guardada} → v${libro.actual}`)
              .join(" · ")}`
          : "Hay cosas en esta lista que el libro actual ya no admite"}
      </p>
      {migracion ? (
        <details open={hayErrores}>
          <summary>
            {pasos.length === 0
              ? "Nada de esta lista cambia con la version nueva"
              : `Que hay que hacer para ajustarla (${pasos.length} ${pasos.length === 1 ? "cambio" : "cambios"})`}
          </summary>
          {pasos.length > 0 ? (
            <ul>
              {pasos.map((paso, i) => (
                <li key={i} className={paso.tipo === "coste" ? "muted" : "warn"}>
                  {paso.mensaje}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="small">
            {resumen("Puntos", migracion.antes.puntos, migracion.despues.puntos)} ·{" "}
            {resumen("Unidades", migracion.antes.unidades, migracion.despues.unidades)} ·{" "}
            {resumen("Miniaturas", migracion.antes.miniaturas, migracion.despues.miniaturas)}
          </p>
        </details>
      ) : (
        <p className="small muted">Cargando el libro actual para ver que cambia…</p>
      )}
      {migracion ? (
        editable ? (
          <button type="button" disabled={busy} onClick={onAjustar}>
            Ajustar al libro actual
          </button>
        ) : (
          <p className="small muted">Pulsa Editar para ajustarla en un borrador.</p>
        )
      ) : null}
    </div>
  );
}

function resumen(que: string, antes: number, despues: number): string {
  const diferencia = despues - antes;
  if (diferencia === 0) return `${que}: ${antes}`;
  return `${que}: ${antes} → ${despues} (${diferencia > 0 ? "+" : "−"}${Math.abs(diferencia)})`;
}
