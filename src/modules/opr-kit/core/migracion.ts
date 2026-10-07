/**
 * Que hay que hacer para pasar una lista guardada al libro de ejercito actual.
 *
 * Una lista se monta contra una version concreta del libro, y Army Forge solo
 * sirve la ultima: cuando sale otra, lo guardado puede llevar unidades que ya
 * no existen, mejoras retiradas o mas elecciones de las que admiten los
 * limites nuevos, y los costes pueden haber cambiado. Aqui se dice que habria
 * que cambiar, unidad a unidad, y como queda la lista despues, sin tocar
 * nada: aplicarlo es guardar `entradas`.
 */
import {
  buildArmy,
  entryCost,
  maxDistinctOptions,
  maxPicks,
  maxPorOpcion,
  optionId,
  rehydrateEntries,
  sectionChosenCount,
  sectionsForEntry,
} from "./builder";
import type { BuilderEntry, CatalogUnitLike, ExtraSectionsForEntry, StoredEntry, UpgradeSection } from "./builder";
import type { ResolvedUnit } from "./armyForgeResolve";
import type { GameSystemId } from "./gameSystems";
import type { HeroClass } from "./model";

export type TipoPaso = "unidad-retirada" | "union-perdida" | "mejora-retirada" | "mejora-de-mas" | "coste";

export interface PasoMigracion {
  /** Posicion de la unidad en la lista guardada. */
  indice: number;
  tipo: TipoPaso;
  mensaje: string;
}

export interface Recuento {
  puntos: number;
  unidades: number;
  miniaturas: number;
}

export interface Migracion {
  /** En el orden de la lista; los cambios de coste no son errores, solo consecuencias. */
  pasos: PasoMigracion[];
  /** La composicion ya ajustada al libro actual. */
  entradas: BuilderEntry[];
  antes: Recuento;
  despues: Recuento;
}

export interface DatosMigracion {
  guardadas: StoredEntry[];
  /** Las unidades tal como se guardaron, en el mismo orden: dan el nombre y el coste de antes. */
  resueltas: ResolvedUnit[];
  /** Los totales guardados, que en una importacion son los de Army Forge. */
  puntos: number;
  miniaturas: number;
  /** El catalogo actual de todos los libros de la lista. */
  units: CatalogUnitLike[];
  packages: Map<string, UpgradeSection[]>;
  defaultBookKey?: string;
  heroClasses?: HeroClass[];
  gameSystem?: GameSystemId;
  extraSections?: ExtraSectionsForEntry;
}

export function planDeMigracion(datos: DatosMigracion): Migracion {
  const { guardadas, resueltas, units, packages, defaultBookKey, extraSections } = datos;
  const enCatalogo = new Set(units.map((unit) => `${unit.bookKey}:${unit.unitId}`));
  const sigue = guardadas.map((guardada) => {
    const bookKey = guardada.bookKey ?? defaultBookKey;
    return Boolean(bookKey && guardada.unitId && enCatalogo.has(`${bookKey}:${guardada.unitId}`));
  });
  const nombre = (indice: number) =>
    resueltas[indice]?.name || guardadas[indice]?.customName || `la unidad ${indice + 1}`;

  const pasos: PasoMigracion[] = [];
  guardadas.forEach((guardada, indice) => {
    if (!sigue[indice]) {
      pasos.push({ indice, tipo: "unidad-retirada", mensaje: `Quitar ${nombre(indice)}: la unidad ya no esta en el libro.` });
    } else if (guardada.attachedTo !== undefined && !sigue[guardada.attachedTo]) {
      pasos.push({
        indice,
        tipo: "union-perdida",
        mensaje: `${nombre(indice)} deja de ir unido a ${nombre(guardada.attachedTo)} y queda suelto.`,
      });
    }
  });

  // `rehydrateEntries` descarta las que no siguen y conserva el orden del
  // resto, asi que la k-esima entrada es la k-esima guardada que sigue.
  const indices = guardadas.flatMap((_, indice) => (sigue[indice] ? [indice] : []));
  const entradas = rehydrateEntries(guardadas, units, defaultBookKey).map((entry, k) => {
    const indice = indices[k];
    const sections = sectionsForEntry(entry, packages, extraSections);
    const { choices, mensajes } = ajustarElecciones(entry, sections, nombre(indice), resueltas[indice]);
    for (const { tipo, mensaje } of mensajes) pasos.push({ indice, tipo, mensaje });
    const ajustada = { ...entry, choices };
    const antes = resueltas[indice]?.cost;
    const despues = entryCost(ajustada, sections);
    if (antes !== undefined && antes !== despues) {
      pasos.push({ indice, tipo: "coste", mensaje: `${nombre(indice)} pasa de ${antes} a ${despues} pts.` });
    }
    return ajustada;
  });

  const built = buildArmy(entradas, packages, datos.heroClasses, datos.gameSystem, extraSections);
  return {
    pasos: pasos.sort((a, b) => a.indice - b.indice),
    entradas,
    antes: { puntos: datos.puntos, unidades: guardadas.length, miniaturas: datos.miniaturas },
    despues: { puntos: built.points, unidades: entradas.length, miniaturas: built.modelCount },
  };
}

/**
 * Las elecciones de una unidad que todavia existe, recortadas a lo que admite
 * el libro actual: fuera las mejoras retiradas, y de las que sobran se quitan
 * las ultimas de cada seccion, que es lo que haria el constructor si se
 * eligieran ahora en ese orden.
 */
function ajustarElecciones(
  entry: BuilderEntry,
  sections: UpgradeSection[],
  nombre: string,
  resuelta: ResolvedUnit | undefined,
): { choices: Record<string, number>; mensajes: Array<{ tipo: TipoPaso; mensaje: string }> } {
  const choices = { ...entry.choices };
  const mensajes: Array<{ tipo: TipoPaso; mensaje: string }> = [];
  const etiqueta = (option: { label?: string }) => `"${option.label ?? "sin nombre"}"`;
  const dondeSeccion = (section: UpgradeSection) => (section.label ? `"${section.label}"` : "esa seccion");

  const ofrecidas = new Set(sections.flatMap((section) => (section.options ?? []).map(optionId)));
  const retiradas = Object.keys(choices).filter((id) => !ofrecidas.has(id));
  if (retiradas.length > 0) {
    for (const id of retiradas) delete choices[id];
    // Las mejoras solo se guardan por id: el nombre de las retiradas sale de
    // lo que se resolvio al guardar, quitando las que siguen elegidas.
    const siguen = new Set(
      sections.flatMap((section) => (section.options ?? []).filter((o) => choices[optionId(o)]).map((o) => o.label)),
    );
    const perdidas = [...new Set((resuelta?.upgrades ?? []).map((label) => label.replace(/^\d+× /, "")))].filter(
      (label) => !siguen.has(label),
    );
    mensajes.push({
      tipo: "mejora-retirada",
      mensaje: perdidas.length
        ? `Quitar ${perdidas.map((label) => `"${label}"`).join(", ")} de ${nombre}: ya no se ofrece.`
        : `Quitar de ${nombre} ${retiradas.length === 1 ? "una mejora que ya no se ofrece" : `${retiradas.length} mejoras que ya no se ofrecen`}.`,
    });
  }

  for (const section of sections) {
    const opciones = section.options ?? [];
    const tope = maxPorOpcion(section, entry.unit.size);
    for (const option of opciones) {
      const actual = choices[optionId(option)] ?? 0;
      if (actual > tope) {
        choices[optionId(option)] = tope;
        mensajes.push({ tipo: "mejora-de-mas", mensaje: `Bajar ${etiqueta(option)} de ${actual} a ${tope} en ${nombre}.` });
      }
    }

    const maximo = maxPicks(section, entry.unit.size);
    let sobran = sectionChosenCount(section, choices) - maximo;
    for (const option of [...opciones].reverse()) {
      if (sobran <= 0) break;
      const actual = choices[optionId(option)] ?? 0;
      if (actual === 0) continue;
      const quita = Math.min(actual, sobran);
      choices[optionId(option)] = actual - quita;
      sobran -= quita;
      mensajes.push({
        tipo: "mejora-de-mas",
        mensaje: `Quitar ${quita > 1 ? `${quita}× ` : ""}${etiqueta(option)} de ${nombre}: ${dondeSeccion(section)} admite como mucho ${maximo}.`,
      });
    }

    const distintas = maxDistinctOptions(section);
    for (const option of opciones.filter((o) => (choices[optionId(o)] ?? 0) > 0).slice(distintas)) {
      delete choices[optionId(option)];
      mensajes.push({
        tipo: "mejora-de-mas",
        mensaje: `Quitar ${etiqueta(option)} de ${nombre}: ${dondeSeccion(section)} admite ${distintas === 1 ? "una sola opcion" : `${distintas} opciones distintas`}.`,
      });
    }
  }

  for (const [id, count] of Object.entries(choices)) if (count <= 0) delete choices[id];
  return { choices, mensajes };
}
