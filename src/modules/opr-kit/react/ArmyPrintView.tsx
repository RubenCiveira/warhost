"use client";

import { useMemo, useState } from "react";
import type { ArmyBook, CatalogRule } from "../core/model";
import type { ResolvedUnit } from "../core/armyForgeResolve";
import { equipoDeEjercito, reglasUsadasEnEjercito, tieneCaster } from "../core/faccion";
import type { EquipoDeFaccion } from "../core/faccion";
import { agruparUnidades, emparejarHeroes } from "../core/unidades";
import type { FilaEjercito } from "../core/unidades";
import { conValor, parseHabilidad } from "../core/reglas";
import type { Habilidad } from "../core/reglas";
import { optionCost } from "../core/builder";
import type { UpgradeOption, UpgradeSection } from "../core/builder";
import { desglosarOpcion } from "../core/opciones";
import { parseSpells, reglasMencionadasEnHechizos } from "../core/spells";
import type { Spell } from "../core/spells";
import type { ArmyNoun } from "../core/gameSystems";
import { cuadriculaPorHoja, PAGINA_MM, trocear, espejarHoja } from "../core/print";
import RuleCard from "./RuleCard";
import SpellCard from "./SpellCard";
import UnitCard from "./UnitCard";
import LoreText from "./LoreText";
import { useTextos } from "./textos";
import type { Textos } from "./textos";

/** Los mismos mm que fijan `--ucard-w/h` y `--scard-w/h` en styles.css: hay
 *  que mantenerlos iguales para que la cuadricula calculada aqui coincida con
 *  el tamano real de la carta en papel. La de personaje mide el doble de
 *  alta —dos perfiles, heroe y unidad, en la misma carta—. */
const TAROT_MM = { ancho: 120, alto: 70 };
const TAROT_PERSONAJE_MM = { ancho: 120, alto: 140 };
const SCARD_MM = { ancho: 44, alto: 68 };
const LIBRO_ALTO_UTIL_MM = PAGINA_MM.alto - PAGINA_MM.margen * 2;

type CartaMiniEuro =
  | { tipo: "regla"; key: string; habilidad: Habilidad; regla: CatalogRule }
  | { tipo: "equipo"; key: string; item: EquipoDeFaccion }
  | { tipo: "hechizo"; key: string; spell: Spell; faccion: string | null };

interface TarjetaLibro {
  key: string;
  unit: ResolvedUnit;
  libro: ArmyBook | undefined;
  avatarUrl?: string | null;
  miniaturaUrl?: string | null;
  parte?: "perfil" | "detalles";
}

function perfilDe(v: ResolvedUnit) {
  return {
    name: v.name,
    size: v.size,
    quality: v.quality,
    defense: v.defense,
    cost: v.cost,
    maxWounds: v.maxWounds,
    rules: v.rules,
    loadout: v.loadout,
    strength: v.strength,
    dexterity: v.dexterity,
    willpower: v.willpower,
    power: v.power,
    level: v.level,
    experience: v.experience,
    gold: v.gold,
  };
}

/** Las cartas de habilidades, equipo, hechizos y reglas generales que
 *  aparecen de verdad en las fichas de estas unidades —directas, por su
 *  equipo o arrastradas por texto—, listas para pintar en Mini Euro. */
function cartasDe(
  glosario: Map<string, CatalogRule>,
  units: ResolvedUnit[],
  libros: ArmyBook[],
  puedeLanzarHechizos?: (unit: ResolvedUnit) => boolean,
): CartaMiniEuro[] {
  const reglasPorNombre = new Map<string, CatalogRule>();
  for (const regla of reglasUsadasEnEjercito(glosario, units)) reglasPorNombre.set(regla.name.toLowerCase(), regla);
  const hechizos: CartaMiniEuro[] = libros.flatMap((libro) => {
    // Una lista importada y todavia no tocada por el constructor no trae
    // `bookKey` en sus unidades. Con una sola faccion conocida no hay
    // ambiguedad: son todas suyas.
    const defaultBookKey = libros.length === 1 ? libros[0].id : undefined;
    const unidadesLibro = units.filter((unit) => (unit.bookKey ?? defaultBookKey) === libro.id);
    if (!unidadesLibro.some((unit) => puedeLanzarHechizos?.(unit) ?? tieneCaster([unit]))) return [];
    const spells = parseSpells(libro.spells ?? null);
    for (const regla of reglasMencionadasEnHechizos(glosario, spells)) reglasPorNombre.set(regla.name.toLowerCase(), regla);
    return spells.map((spell) => ({
      tipo: "hechizo" as const,
      key: `hechizo-${libro.id}-${spell.key}`,
      spell,
      faccion: libro.factionName ?? libro.name,
    }));
  });
  const reglas: CartaMiniEuro[] = [...reglasPorNombre.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((regla) => ({ tipo: "regla", key: `regla-${regla.name.toLowerCase()}`, habilidad: parseHabilidad(regla.name, "regla"), regla }));
  const equipo: CartaMiniEuro[] = equipoDeEjercito(units).map((item) => ({
    tipo: "equipo",
    key: `equipo-${item.habilidad.nombre}`,
    item,
  }));
  return [...reglas, ...equipo, ...hechizos];
}

function CartaMiniEuroVista({ carta, glosario }: { carta: CartaMiniEuro; glosario: Map<string, CatalogRule> }) {
  if (carta.tipo === "regla") return <RuleCard habilidad={carta.habilidad} regla={carta.regla} glosario={glosario} />;
  if (carta.tipo === "equipo") return <RuleCard habilidad={carta.item.habilidad} lleva={carta.item.unidades} glosario={glosario} />;
  return <SpellCard spell={carta.spell} faction={carta.faccion} glosario={glosario} />;
}

/** El nombre tal como se escribe (con su valor) y el texto de su
 *  descripcion, ya con el valor metido donde el glosario pone una X. Sin
 *  descripcion no hay fila vacia: se deja en null y quien pinta decide. */
function textoDeRegla(etiqueta: string, glosario: Map<string, CatalogRule>): { nombre: string; texto: string | null } {
  const habilidad = parseHabilidad(etiqueta, "regla");
  const regla = glosario.get(habilidad.nombre.toLowerCase());
  return { nombre: habilidad.etiqueta, texto: regla?.description ? conValor(regla.description, habilidad.valor) : null };
}

/** Una regla por parrafo, nombre en negrita seguido del texto: es lo que va
 *  en la columna ancha de armas y equipo, que puede llevar varias reglas. */
function ReglasTexto({ etiquetas, glosario }: { etiquetas: string[]; glosario: Map<string, CatalogRule> }) {
  if (etiquetas.length === 0) return <span className="muted">—</span>;
  return (
    <>
      {etiquetas.map((etiqueta) => {
        const { nombre, texto } = textoDeRegla(etiqueta, glosario);
        return (
          <p key={etiqueta} className="libro-regla">
            <strong>{nombre}</strong>
            {texto ? `: ${texto}` : ""}
          </p>
        );
      })}
    </>
  );
}

function lineasDeTexto(texto: string | null | undefined, caracteresPorLinea: number): number {
  if (!texto) return 1;
  return Math.max(1, Math.ceil(texto.length / caracteresPorLinea));
}

function lineasDeReglas(etiquetas: string[], glosario: Map<string, CatalogRule>): number {
  if (etiquetas.length === 0) return 1;
  return etiquetas.reduce((total, etiqueta) => total + lineasDeTexto(textoDeRegla(etiqueta, glosario).texto, 92), 0);
}

function altoLibroEstimadoMm(unit: ResolvedUnit, glosario: Map<string, CatalogRule>, hechizos: Spell[]): number {
  const armas = unit.loadout.filter((entrada) => entrada.kind === "weapon");
  const equipo = unit.loadout.filter((entrada) => entrada.kind === "gear");
  const filasArmas = armas.reduce((total, arma) => total + lineasDeReglas(arma.rules, glosario), 0);
  const filasReglas = unit.rules.reduce((total, etiqueta) => total + lineasDeTexto(textoDeRegla(etiqueta, glosario).texto, 100), 0);
  const filasEquipo = equipo.reduce((total, item) => total + lineasDeReglas(item.rules, glosario), 0);
  const filasHechizos = hechizos.reduce((total, spell) => total + lineasDeTexto(spell.effect, 100), 0);
  return 22 + armas.length * 8 + filasArmas * 4.1 + unit.rules.length * 7 + filasReglas * 4.1 + equipo.length * 7 + filasEquipo * 4.1 + hechizos.length * 7 + filasHechizos * 4.1 + (unit.notes ? lineasDeTexto(unit.notes, 110) * 4.1 + 8 : 0);
}

function LibroCabecera({ unit, parte, avatarUrl }: { unit: ResolvedUnit; parte?: string; avatarUrl?: string | null }) {
  const t = useTextos();
  return (
    <header className="ucard-head libro-cab">
      <h3 className="ucard-title libro-nombre">
        {unit.name}
        {unit.size > 1 ? ` (${unit.size})` : ""}
        {unit.combined ? <span className="ucard-combinada">{t.combinada}</span> : null}
        {parte ? <span className="libro-parte">{parte}</span> : null}
      </h3>
      {avatarUrl ? <img className="ucard-avatar libro-avatar" src={avatarUrl} alt="" loading="lazy" /> : null}
      <div className="ucard-stats libro-stats">
        <div className="ucard-stat">
          <span className="ucard-stat-key">{t.calidad}</span>
          <span className="ucard-stat-value">{unit.quality}+</span>
        </div>
        <div className="ucard-stat">
          <span className="ucard-stat-key">{t.defensa}</span>
          <span className="ucard-stat-value">{unit.defense}+</span>
        </div>
        {unit.maxWounds !== undefined ? (
          <div className="ucard-stat">
            <span className="ucard-stat-key">{t.heridas}</span>
            <span className="ucard-stat-value">{unit.maxWounds}</span>
          </div>
        ) : null}
        <div className="ucard-stat">
          <span className="ucard-stat-key">{t.puntos}</span>
          <span className="ucard-stat-value">{unit.cost}</span>
        </div>
      </div>
    </header>
  );
}

function TablaArmasLibro({ armas, glosario }: { armas: ResolvedUnit["loadout"]; glosario: Map<string, CatalogRule> }) {
  const t = useTextos();
  if (armas.length === 0) return null;
  return (
    <section className="ucard-bloque libro-bloque">
      <h4 className="ucard-bloque-title">{t.armas}</h4>
      <table className="ucard-table libro-tabla">
        <thead>
          <tr>
            <th className="libro-col-nombre">{t.arma}</th>
            <th>{t.alcance}</th>
            <th>{t.ataques}</th>
            <th className="libro-col-reglas">{t.reglas}</th>
          </tr>
        </thead>
        <tbody>
          {armas.map((arma, indice) => (
            <tr key={`${arma.name}-${indice}`}>
              <td className="libro-col-nombre">
                {arma.count > 1 ? `${arma.count}× ` : ""}
                {arma.name}
              </td>
              <td className="num">{arma.range ? `${arma.range}\"` : t.cuerpoACuerpo}</td>
              <td className="num">A{arma.attacks}</td>
              <td className="libro-col-reglas">
                <ReglasTexto etiquetas={arma.rules} glosario={glosario} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TablaReglasLibro({ reglas, glosario }: { reglas: string[]; glosario: Map<string, CatalogRule> }) {
  const t = useTextos();
  if (reglas.length === 0) return null;
  return (
    <section className="ucard-bloque libro-bloque">
      <h4 className="ucard-bloque-title">{t.reglas}</h4>
      <table className="ucard-table libro-tabla">
        <thead>
          <tr>
            <th className="libro-col-nombre">{t.regla}</th>
            <th className="libro-col-reglas">{t.texto}</th>
          </tr>
        </thead>
        <tbody>
          {reglas.map((etiqueta) => {
            const { nombre, texto } = textoDeRegla(etiqueta, glosario);
            return (
              <tr key={etiqueta}>
                <td className="libro-col-nombre">{nombre}</td>
                <td className="libro-col-reglas">{texto ?? <span className="ucard-vacio">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function TablaEquipoLibro({ equipo, glosario }: { equipo: ResolvedUnit["loadout"]; glosario: Map<string, CatalogRule> }) {
  const t = useTextos();
  if (equipo.length === 0) return null;
  return (
    <section className="ucard-bloque libro-bloque">
      <h4 className="ucard-bloque-title">{t.equipo}</h4>
      <table className="ucard-table libro-tabla">
        <thead>
          <tr>
            <th className="libro-col-nombre">{t.equipo}</th>
            <th className="libro-col-reglas">{t.concede}</th>
          </tr>
        </thead>
        <tbody>
          {equipo.map((item, indice) => (
            <tr key={`${item.name}-${indice}`}>
              <td className="libro-col-nombre">{item.name}</td>
              <td className="libro-col-reglas">
                <ReglasTexto etiquetas={item.rules} glosario={glosario} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TablaHechizosLibro({ hechizos }: { hechizos: Spell[] }) {
  const t = useTextos();
  if (hechizos.length === 0) return null;
  return (
    <section className="ucard-bloque libro-bloque">
      <h4 className="ucard-bloque-title">{t.hechizos}</h4>
      <table className="ucard-table libro-tabla">
        <thead>
          <tr>
            <th className="libro-col-nombre">{t.hechizo}</th>
            <th>{t.valor}</th>
            <th className="libro-col-reglas">{t.efecto}</th>
          </tr>
        </thead>
        <tbody>
          {hechizos.map((spell) => (
            <tr key={spell.key}>
              <td className="libro-col-nombre">{spell.name}</td>
              <td className="num">{spell.threshold}+</td>
              <td className="libro-col-reglas">{spell.effect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function textoGanancia(option: UpgradeOption): string | null {
  const desglose = desglosarOpcion(option);
  if (desglose.crudo) return option.label ?? null;
  const ganancias = desglose.ganancias.map((ganancia) => {
    const cantidad = ganancia.cuantas > 1 ? `${ganancia.cuantas}x ` : "";
    return `${cantidad}${ganancia.nombre}${ganancia.perfil ? ` (${ganancia.perfil})` : ""}`;
  });
  return ganancias.length > 0 ? ganancias.join("; ") : null;
}

function reglasDeOpcion(option: UpgradeOption): string[] {
  const desglose = desglosarOpcion(option);
  return [...desglose.reglas, ...desglose.ganancias.flatMap((ganancia) => ganancia.reglas)].map((regla) => regla.etiqueta);
}

function TablaOpcionesLibro({
  section,
  unitId,
  glosario,
}: {
  section: UpgradeSection;
  unitId: string;
  glosario: Map<string, CatalogRule>;
}) {
  const t = useTextos();
  return (
    <section className="ucard-bloque libro-bloque libro-opciones">
      <table className="ucard-table libro-tabla">
        <thead>
          <tr>
            <th className="libro-col-nombre">{t.opcion}</th>
            <th>{t.coste}</th>
            <th>{t.concede}</th>
            <th className="libro-col-reglas">{t.reglas}</th>
          </tr>
        </thead>
        <tbody>
          {(section.options ?? []).map((option) => (
            <tr key={option.id ?? option.uid ?? option.label}>
              <td className="libro-col-nombre">{option.label ?? t.opcion}</td>
              <td className="num">{optionCost(option, unitId) === 0 ? t.gratis : `+${optionCost(option, unitId)}`}</td>
              <td>{textoGanancia(option) ?? <span className="ucard-vacio">—</span>}</td>
              <td className="libro-col-reglas">
                <ReglasTexto etiquetas={reglasDeOpcion(option)} glosario={glosario} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function tipoConfiguracion(section: UpgradeSection, t: Textos): string {
  const limite = section.select?.value ? ` ${section.select.value}` : "";
  return `${section.variant ?? t.configuracion}${limite}`;
}

export function FichaOpcionesLibro({
  nombre,
  unitId,
  sections,
  glosario,
}: {
  nombre: string;
  unitId: string;
  sections: UpgradeSection[];
  glosario: Map<string, CatalogRule>;
}) {
  const t = useTextos();
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((section) => (
        <article key={section.id ?? section.uid} className="ucard ucard-ejercito libro-ficha libro-ficha-opciones">
          <header className="ucard-head libro-cab">
            <h3 className="ucard-title libro-nombre">
              {nombre}
              <span className="libro-opciones-separador">/</span>
              {section.label ?? t.opciones}
            </h3>
            <p className="libro-opciones-meta">
              <span>{t.tipo}: {tipoConfiguracion(section, t)}</span>
              <span>{t.unidad}: {nombre}</span>
            </p>
          </header>
          <div className="ucard-body libro-cuerpo">
            <TablaOpcionesLibro section={section} unitId={unitId} glosario={glosario} />
          </div>
        </article>
      ))}
    </>
  );
}

export function FichaUnidadLibro({
  unit,
  glosario,
  libro,
  parte,
  avatarUrl,
  lore,
  miniaturaUrl,
  puedeLanzarHechizos,
}: {
  unit: ResolvedUnit;
  glosario: Map<string, CatalogRule>;
  libro: ArmyBook | undefined;
  parte?: "perfil" | "detalles";
  avatarUrl?: string | null;
  lore?: string | null;
  miniaturaUrl?: string | null;
  puedeLanzarHechizos?: (unit: ResolvedUnit) => boolean;
}) {
  const t = useTextos();
  const armas = unit.loadout.filter((entrada) => entrada.kind === "weapon");
  const equipo = unit.loadout.filter((entrada) => entrada.kind === "gear");
  const hechizos = libro && (puedeLanzarHechizos?.(unit) ?? tieneCaster([unit])) ? parseSpells(libro.spells ?? null) : [];
  const reglasHechizos = reglasMencionadasEnHechizos(glosario, hechizos).map((regla) => regla.name);
  const reglasUnidad = [...unit.rules, ...reglasHechizos.filter((nombre) => !unit.rules.some((regla) => parseHabilidad(regla, "regla").nombre.toLowerCase() === nombre.toLowerCase()))];
  const dividida = parte !== undefined;

  return (
    <article className={`ucard ucard-ejercito libro-ficha${avatarUrl ? " con-avatar" : ""}${miniaturaUrl ? " con-miniatura" : ""}`}>
      <LibroCabecera unit={unit} avatarUrl={avatarUrl} parte={dividida ? (parte === "perfil" ? "1/2" : "2/2") : undefined} />
      {miniaturaUrl ? <img className="libro-miniatura" src={miniaturaUrl} alt="" loading="lazy" /> : null}
      {dividida ? <p className="libro-aviso">{t.fichaDividida}</p> : null}
      <div className="ucard-body libro-cuerpo">
        {lore && parte !== "detalles" ? <LoreText text={lore} className="libro-lore" /> : null}
        {parte !== "detalles" ? (
          <TablaArmasLibro armas={armas} glosario={glosario} />
        ) : null}
        {parte !== "perfil" ? (
          <>
            <TablaReglasLibro reglas={reglasUnidad} glosario={glosario} />
            <TablaEquipoLibro equipo={equipo} glosario={glosario} />
            <TablaHechizosLibro hechizos={hechizos} />
            {unit.notes ? (
              <p className="ucard-notas libro-notas">
                <span className="ucard-label">{t.notas}</span>
                {unit.notes}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

function tarjetasDeUnidadLibro(
  unit: ResolvedUnit,
  glosario: Map<string, CatalogRule>,
  libro: ArmyBook | undefined,
  avatarUrl?: string | null,
  puedeLanzarHechizos?: (unit: ResolvedUnit) => boolean,
): TarjetaLibro[] {
  const hechizos = libro && (puedeLanzarHechizos?.(unit) ?? tieneCaster([unit])) ? parseSpells(libro.spells ?? null) : [];
  const hayDetalles = unit.rules.length > 0 || unit.loadout.some((entrada) => entrada.kind === "gear") || hechizos.length > 0 || Boolean(unit.notes);
  const partir = hayDetalles && altoLibroEstimadoMm(unit, glosario, hechizos) > LIBRO_ALTO_UTIL_MM;
  const keyBase = `${unit.unitKey ?? unit.name}-${unit.sortOrder}`;
  if (!partir) return [{ key: keyBase, unit, libro, avatarUrl }];
  return [
    { key: `${keyBase}-perfil`, unit, libro, avatarUrl, parte: "perfil" },
    { key: `${keyBase}-detalles`, unit, libro, parte: "detalles" },
  ];
}

function ResumenEjercito({ units }: { units: ResolvedUnit[] }) {
  const t = useTextos();
  const puntos = units.reduce((total, unit) => total + unit.cost, 0);
  const miniaturas = units.reduce((total, unit) => total + unit.size, 0);
  return (
    <p className="print-ejercito-resumen">
      {t.resumen(puntos, units.length, miniaturas)}
    </p>
  );
}

/**
 * Modo libro: tarjetas grandes de unidad con el texto completo de cada regla.
 * Fluyen una detras de otra para llenar cada pagina; si una se estima mas
 * alta que una pagina, se divide en dos tarjetas marcadas. Encabeza el
 * nombre con sus totales; con aliados, cada faccion abre su propio bloque
 * con los suyos, y con una sola la faccion va de subtitulo sin repetirlos.
 */
function VistaLibro({
  nombre,
  units,
  glosario,
  librosConocidos,
  avatarDe,
  puedeLanzarHechizos,
  noun,
}: {
  nombre: string;
  units: ResolvedUnit[];
  glosario: Map<string, CatalogRule>;
  librosConocidos: ArmyBook[];
  avatarDe?: (unit: ResolvedUnit) => string | null;
  puedeLanzarHechizos?: (unit: ResolvedUnit) => boolean;
  noun: ArmyNoun;
}) {
  const t = useTextos();
  // Una lista importada y todavia no tocada por el constructor no trae
  // `bookKey` en sus unidades. Con una sola faccion conocida no hay
  // ambiguedad: son todas suyas.
  const defaultBookKey = librosConocidos.length === 1 ? librosConocidos[0].id : undefined;
  const bloques = useMemo(() => {
    const libroDe = (unit: ResolvedUnit) => librosConocidos.find((libro) => (unit.bookKey ?? defaultBookKey) === libro.id);
    const tarjetasDe = (unidades: ResolvedUnit[]) =>
      agruparUnidades(unidades).flatMap((seccion) =>
        seccion.unidades.flatMap((unit) =>
          tarjetasDeUnidadLibro(unit, glosario, libroDe(unit), avatarDe?.(unit) ?? null, puedeLanzarHechizos),
        ),
      );
    if (librosConocidos.length <= 1) return [{ key: "todas", libro: librosConocidos[0], units, tarjetas: tarjetasDe(units) }];
    const porLibro = librosConocidos.map((libro) => ({ key: libro.id, libro: libro as ArmyBook | undefined, units: units.filter((unit) => libroDe(unit) === libro) }));
    const sinLibro = units.filter((unit) => !libroDe(unit));
    return [...porLibro, { key: "sin-faccion", libro: undefined, units: sinLibro }]
      .filter((bloque) => bloque.units.length > 0)
      .map((bloque) => ({ ...bloque, tarjetas: tarjetasDe(bloque.units) }));
  }, [avatarDe, defaultBookKey, glosario, librosConocidos, puedeLanzarHechizos, units]);

  if (units.length === 0) return <p className="muted">{t.sinUnidades(noun)}</p>;

  const variasFacciones = librosConocidos.length > 1;
  return (
    <div className="print-libro">
      <header className="print-faccion-titulo">
        <h1>{nombre || noun.singular}</h1>
        {!variasFacciones && librosConocidos[0] ? <p className="print-ejercito-subtitulo">{librosConocidos[0].name}</p> : null}
        <ResumenEjercito units={units} />
      </header>
      {bloques.map((bloque) => (
        <section key={bloque.key} className="print-unidad">
          {variasFacciones ? (
            <header className="print-faccion-titulo print-faccion-bloque">
              <h2>{bloque.libro?.name ?? t.sinFaccion}</h2>
              <ResumenEjercito units={bloque.units} />
            </header>
          ) : null}
          {bloque.tarjetas.map((tarjeta) => (
            <FichaUnidadLibro
              key={tarjeta.key}
              unit={tarjeta.unit}
              glosario={glosario}
              libro={tarjeta.libro}
              avatarUrl={tarjeta.avatarUrl}
              miniaturaUrl={tarjeta.miniaturaUrl}
              parte={tarjeta.parte}
              puedeLanzarHechizos={puedeLanzarHechizos}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Modo tarjetas con dorso: cada mazo —tarot para las unidades, Mini Euro para
 * el resto— se reparte en hojas completas, y cada hoja de anverso lleva justo
 * detras su hoja de reverso con las columnas invertidas. Imprimiendo primero
 * las hojas impares y despues, con el mismo papel volteado por el borde
 * largo, las pares, cada carta cae encima de su dorso listo para recortar.
 * Aqui no se repite ninguna carta: cada una sale una sola vez para toda
 * {noun.singular}, a diferencia del modo libro.
 */
function VistaTarjetas({
  filas,
  cartas,
  glosario,
  quest,
  avatarDe,
}: {
  filas: FilaEjercito[];
  cartas: CartaMiniEuro[];
  glosario: Map<string, CatalogRule>;
  quest: boolean;
  avatarDe?: (unit: ResolvedUnit) => string | null;
}) {
  const t = useTextos();
  const tarotMm = quest ? TAROT_PERSONAJE_MM : TAROT_MM;
  // Una carta tipo tarot es mas ancha que alta: una hoja tambien apaisada
  // aprovecha mejor el papel (cuatro por hoja en vez de tres).
  const { columnas: tarotCols, filas: tarotFilas } = cuadriculaPorHoja(tarotMm.ancho, tarotMm.alto, true);
  const { columnas: scardCols, filas: scardFilas } = cuadriculaPorHoja(SCARD_MM.ancho, SCARD_MM.alto);
  const hojasTarot = trocear(filas, tarotCols * tarotFilas);
  const hojasScard = trocear(cartas, scardCols * scardFilas);
  const estiloTarot = { gridTemplateColumns: `repeat(${tarotCols}, calc(var(--ucard-w) * var(--ucard-esc)))` };
  const estiloScard = { gridTemplateColumns: `repeat(${scardCols}, calc(var(--scard-w) * var(--scard-esc)))` };

  return (
    <div className="print-tarjetas">
      {filas.length > 0 ? (
        <section className="print-mazo print-mazo-apaisado">
          <h3 className="print-mazo-title">{t.mazoUnidades}</h3>
          {hojasTarot.map((hoja, indice) => (
            <div key={`tarot-${indice}`}>
              <div className="print-hoja" style={estiloTarot}>
                {hoja.map((fila) => (
                  <UnitCard
                    key={fila.key}
                    variant="ejercito"
                    quest={quest}
                    formato={quest ? "personaje" : "tarot"}
                    glosario={glosario}
                    avatarUrl={avatarDe?.(fila.principal) ?? null}
                    unit={perfilDe(fila.principal)}
                    combinada={fila.principal.combined}
                    notas={fila.principal.notes}
                    adjunta={fila.adjunta ? { ...perfilDe(fila.adjunta), combinada: fila.adjunta.combined } : undefined}
                  />
                ))}
              </div>
              <div className="print-hoja print-reverso" style={estiloTarot}>
                {espejarHoja(hoja, tarotCols).map((fila, celda) =>
                  fila ? (
                    <div key={fila.key} className="print-dorso print-dorso-tarot" />
                  ) : (
                    <div key={`vacio-${celda}`} className="print-dorso print-dorso-vacio" />
                  ),
                )}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      {cartas.length > 0 ? (
        <section className="print-mazo">
          <h3 className="print-mazo-title">{t.mazoCartas}</h3>
          {hojasScard.map((hoja, indice) => (
            <div key={`scard-${indice}`}>
              <div className="print-hoja" style={estiloScard}>
                {hoja.map((carta) => (
                  <CartaMiniEuroVista key={carta.key} carta={carta} glosario={glosario} />
                ))}
              </div>
              <div className="print-hoja print-reverso" style={estiloScard}>
                {espejarHoja(hoja, scardCols).map((carta, celda) =>
                  carta ? (
                    <div key={carta.key} className="print-dorso print-dorso-scard" />
                  ) : (
                    <div key={`vacio-${celda}`} className="print-dorso print-dorso-vacio" />
                  ),
                )}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Asistente de impresion: primero se elige el modo, y solo entonces se
 * compone la hoja —construir los dos mazos por adelantado para una lista
 * grande es trabajo de sobra si al final no se usan.
 */
export default function ArmyPrintView({
  nombre,
  noun,
  quest,
  units,
  entradasAttachedTo,
  glosario,
  librosConocidos,
  avatarDe,
  puedeLanzarHechizos,
  onCerrar,
}: {
  nombre: string;
  noun: ArmyNoun;
  quest: boolean;
  units: ResolvedUnit[];
  /** `attachedTo` de cada entrada guardada, en el mismo orden que `units`: hace falta para emparejar heroe y unidad en el modo de tarjetas. */
  entradasAttachedTo: Array<number | undefined>;
  glosario: Map<string, CatalogRule>;
  librosConocidos: ArmyBook[];
  avatarDe?: (unit: ResolvedUnit) => string | null;
  puedeLanzarHechizos?: (unit: ResolvedUnit) => boolean;
  onCerrar: () => void;
}) {
  const t = useTextos();
  const [modo, setModo] = useState<"elegir" | "libro" | "tarjetas">("elegir");
  const filas = useMemo(() => emparejarHeroes(units, entradasAttachedTo), [units, entradasAttachedTo]);
  const cartas = useMemo(() => cartasDe(glosario, units, librosConocidos, puedeLanzarHechizos), [glosario, units, librosConocidos, puedeLanzarHechizos]);

  return (
    <div className="print-vista">
      <div className="print-toolbar">
        <button type="button" onClick={() => (modo === "elegir" ? onCerrar() : setModo("elegir"))}>
          {modo === "elegir" ? t.cancelar : t.volverAElegir}
        </button>
        <h2 className="print-toolbar-title">{t.imprimirTitulo(nombre || noun.singular)}</h2>
        {modo !== "elegir" ? (
          <button type="button" className="primary" onClick={() => window.print()}>
            {t.imprimir}
          </button>
        ) : null}
      </div>

      {modo === "elegir" ? (
        <div className="print-asistente">
          <p className="muted">{t.eligeModo(noun)}</p>
          <div className="print-opciones">
            <button type="button" className="print-opcion" onClick={() => setModo("libro")}>
              <strong>{t.modoLibro}</strong>
              <span>{t.modoLibroAyuda}</span>
            </button>
            <button type="button" className="print-opcion" onClick={() => setModo("tarjetas")}>
              <strong>{t.modoTarjetas}</strong>
              <span>{t.modoTarjetasAyuda}</span>
            </button>
          </div>
        </div>
      ) : modo === "libro" ? (
        <VistaLibro
          nombre={nombre}
          units={units}
          glosario={glosario}
          librosConocidos={librosConocidos}
          avatarDe={avatarDe}
          puedeLanzarHechizos={puedeLanzarHechizos}
          noun={noun}
        />
      ) : (
        <VistaTarjetas filas={filas} cartas={cartas} glosario={glosario} quest={quest} avatarDe={avatarDe} />
      )}
    </div>
  );
}
