import type { ComponentProps, ReactNode } from "react";
import { Circle, Document, Image, Page, Path, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import type { ArmyBook, CatalogRule } from "../core/model";
import type { ResolvedUnit } from "../core/armyForgeResolve";
import type { LoadoutEntry } from "../core/loadout";
import { equipoDeEjercito, reglasUsadasEnEjercito, tieneCaster } from "../core/faccion";
import { agruparUnidades, emparejarHeroes } from "../core/unidades";
import type { FilaEjercito } from "../core/unidades";
import { conValor, parseHabilidad } from "../core/reglas";
import type { Habilidad } from "../core/reglas";
import { reglaDelAura } from "../core/auras";
import { parseSpells, reglasMencionadasEnHechizos } from "../core/spells";
import type { Spell } from "../core/spells";
import type { ArmyNoun } from "../core/gameSystems";
import { HUECO_MM, PAGINA_MM, cuadriculaPorHoja, espejarHoja, trocear } from "../core/print";
import { ARMAS_VISIBLES, ARMAS_VISIBLES_COLUMNA, aportesDelHeroe, densidad } from "./UnitCard";
import { densidadScard } from "./cardDensity";
import {
  CEBRA,
  FILETE,
  ALTO_UTIL_MM,
  FichaUnidadPdf,
  PAPEL,
  Pie,
  TEMAS,
  TENUE,
  TINTA,
  altoLibroEstimadoMm,
  estilosDe,
  imagenesParaPdf,
  mm,
  registrarFuentes,
  rotuloDe,
} from "./pdfComun";
import type { Ambientacion, Tema } from "./pdfComun";
import type { Textos } from "./textos";

/**
 * Los dos PDF de un ejercito, dibujados como texto con react-pdf.
 *
 * Modo libro: fichas grandes con el texto completo de cada regla, una detras
 * de otra; con aliados, cada faccion abre su bloque con sus totales.
 *
 * Modo tarjetas: cada mazo —tarot para las unidades, Mini Euro para el
 * resto— se reparte en hojas completas, y cada hoja de anverso lleva justo
 * detras su hoja de reverso con las columnas invertidas. Imprimiendo a doble
 * cara por el borde largo, cada carta cae encima de su dorso. Las cartas son
 * las de UnitCard, RuleCard y SpellCard, con las medidas de `.ucard` y
 * `.scard` en styles.css.
 */

/** Los mm de `--ucard-w/h` y `--scard-w/h` en styles.css. La de personaje
 *  mide el doble de alta: perfil y campana del heroe en la misma carta. */
const TAROT_MM = { ancho: 120, alto: 70 };
const TAROT_PERSONAJE_MM = { ancho: 120, alto: 140 };
const SCARD_MM = { ancho: 44, alto: 68 };

type CartaMiniEuro =
  | { tipo: "regla"; key: string; habilidad: Habilidad; regla: CatalogRule }
  | { tipo: "equipo"; key: string; habilidad: Habilidad; lleva: string[] }
  | { tipo: "hechizo"; key: string; spell: Spell; faccion: string | null };

/** Las cartas de habilidades, equipo, hechizos y reglas generales que
 *  aparecen de verdad en las fichas de estas unidades —directas, por su
 *  equipo o arrastradas por texto—. */
function cartasDe(
  glosario: Map<string, CatalogRule>,
  units: ResolvedUnit[],
  libros: ArmyBook[],
  puedeLanzarHechizos?: (unit: ResolvedUnit) => boolean,
): CartaMiniEuro[] {
  const reglasPorNombre = new Map<string, CatalogRule>();
  for (const regla of reglasUsadasEnEjercito(glosario, units)) reglasPorNombre.set(regla.name.toLowerCase(), regla);
  // Una lista importada y todavia no tocada por el constructor no trae
  // `bookKey` en sus unidades. Con una sola faccion conocida no hay
  // ambiguedad: son todas suyas.
  const defaultBookKey = libros.length === 1 ? libros[0].id : undefined;
  const hechizos: CartaMiniEuro[] = libros.flatMap((libro) => {
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
    habilidad: item.habilidad,
    lleva: item.unidades,
  }));
  return [...reglas, ...equipo, ...hechizos];
}

/** Lo que se cuenta en la cabecera: puntos, unidades y miniaturas. */
function resumen(t: Textos, units: ResolvedUnit[]): string {
  return t.resumen(
    units.reduce((total, unit) => total + unit.cost, 0),
    units.length,
    units.reduce((total, unit) => total + unit.size, 0),
  );
}

export interface OpcionesPdfEjercito {
  modo: "libro" | "tarjetas";
  nombre: string;
  noun: ArmyNoun;
  quest: boolean;
  units: ResolvedUnit[];
  /** `attachedTo` de cada entrada guardada, en el mismo orden que `units`: empareja heroe y unidad en las tarjetas. */
  entradasAttachedTo: Array<number | undefined>;
  glosario: Map<string, CatalogRule>;
  librosConocidos: ArmyBook[];
  avatarDe?: (unit: ResolvedUnit) => string | null;
  puedeLanzarHechizos?: (unit: ResolvedUnit) => boolean;
  t: Textos;
  ambientacion: Ambientacion;
}

export async function generarPdfEjercito(opciones: OpcionesPdfEjercito): Promise<Blob> {
  registrarFuentes();
  // Los avatares miden 13 mm de ancho: 300 px sobran.
  const avatares = await imagenesParaPdf(opciones.units.map((unit) => opciones.avatarDe?.(unit)), 300, PAPEL);
  const avatarDe = (unit: ResolvedUnit) => avatares.get(opciones.avatarDe?.(unit) ?? "") ?? null;
  const documento = opciones.modo === "libro" ? libro(opciones, avatarDe) : tarjetas(opciones, avatarDe);
  return pdf(documento).toBlob();
}

// ── Modo libro ───────────────────────────────────────────────────────────────

function libro(
  { nombre, noun, units, glosario, librosConocidos, puedeLanzarHechizos, t, ambientacion }: OpcionesPdfEjercito,
  avatarDe: (unit: ResolvedUnit) => string | null,
) {
  const s = estilosDe(TEMAS[ambientacion]);
  const titulo = nombre || noun.singular;
  const defaultBookKey = librosConocidos.length === 1 ? librosConocidos[0].id : undefined;
  const libroDe = (unit: ResolvedUnit) => librosConocidos.find((libro) => (unit.bookKey ?? defaultBookKey) === libro.id);
  const variasFacciones = librosConocidos.length > 1;
  const bloques = variasFacciones
    ? [
        ...librosConocidos.map((libro) => ({ key: libro.id, libro: libro as ArmyBook | undefined, units: units.filter((unit) => libroDe(unit) === libro) })),
        { key: "sin-faccion", libro: undefined, units: units.filter((unit) => !libroDe(unit)) },
      ].filter((bloque) => bloque.units.length > 0)
    : [{ key: "todas", libro: librosConocidos[0], units }];

  return (
    <Document title={titulo}>
      <Page size="A4" style={s.pagina}>
        <Text style={s.titulo}>{titulo}</Text>
        {!variasFacciones && librosConocidos[0] ? <Text style={s.subtitulo}>{librosConocidos[0].name}</Text> : null}
        <Text style={s.resumen}>{resumen(t, units)}</Text>
        {units.length === 0 ? <Text style={s.vacio}>{t.sinUnidades(noun)}</Text> : null}
        {bloques.map((bloque) => {
          const fichas = agruparUnidades(bloque.units)
            .flatMap((seccion) => seccion.unidades)
            .map((unit) => {
              const libroUnidad = libroDe(unit);
              const lanza = libroUnidad && (puedeLanzarHechizos?.(unit) ?? tieneCaster([unit]));
              const hechizos = lanza ? parseSpells(libroUnidad.spells ?? null) : [];
              return {
                cabe: altoLibroEstimadoMm(unit, glosario, hechizos) <= ALTO_UTIL_MM,
                ficha: (
                  <FichaUnidadPdf
                    key={`${unit.unitKey ?? unit.name}-${unit.sortOrder}`}
                    s={s}
                    t={t}
                    unit={unit}
                    glosario={glosario}
                    hechizos={hechizos}
                    avatar={avatarDe(unit)}
                  />
                ),
              };
            });
          // El nombre de cada faccion aliada salta de pagina con su primera
          // ficha: nunca se queda solo al pie.
          const [primera, ...resto] = fichas;
          return (
            <View key={bloque.key}>
              {variasFacciones ? (
                <View wrap={!primera?.cabe}>
                  <Text style={s.seccion}>{bloque.libro?.name ?? t.sinFaccion}</Text>
                  <Text style={s.resumen}>{resumen(t, bloque.units)}</Text>
                  {primera?.ficha}
                </View>
              ) : (
                primera?.ficha
              )}
              {resto.map(({ ficha }) => ficha)}
            </View>
          );
        })}
        <Pie s={s} texto={titulo} />
      </Page>
    </Document>
  );
}

// ── Modo tarjetas ────────────────────────────────────────────────────────────

/** Los tamanos que cambian segun la carta vaya holgada, densa o a media
 *  anchura: los escalones `.denso`, `.muy-denso` y `.ucard-columna`. */
interface Medidas {
  tabla: number;
  celdaV: number;
  celdaH: number;
  chip: number;
  chipV: number;
  chipH: number;
  hueco: number;
  chipArma: number;
  chipArmaV: number;
  chipArmaH: number;
  titulo: number;
}
const MEDIDAS: Record<"" | " denso" | " muy-denso" | "columna", Medidas> = {
  "": { tabla: 2.6, celdaV: 0.7, celdaH: 1.4, chip: 2.38, chipV: 0.6, chipH: 1.6, hueco: 1, chipArma: 2.2, chipArmaV: 0.3, chipArmaH: 1.1, titulo: 2.2 },
  " denso": { tabla: 2.4, celdaV: 0.5, celdaH: 1.4, chip: 2.2, chipV: 0.6, chipH: 1.6, hueco: 1, chipArma: 2.2, chipArmaV: 0.3, chipArmaH: 1.1, titulo: 2.2 },
  " muy-denso": { tabla: 2.2, celdaV: 0.35, celdaH: 1.4, chip: 2.05, chipV: 0.6, chipH: 1.6, hueco: 1, chipArma: 2.05, chipArmaV: 0.3, chipArmaH: 1.1, titulo: 2.2 },
  columna: { tabla: 1.95, celdaV: 0.35, celdaH: 0.9, chip: 1.85, chipV: 0.3, chipH: 1, hueco: 0.5, chipArma: 1.85, chipArmaV: 0.3, chipArmaH: 1, titulo: 1.8 },
};

function estilosCartas(tema: Tema) {
  const rotulo = rotuloDe(tema);
  return StyleSheet.create({
    hoja: { paddingTop: mm(PAGINA_MM.margen), fontFamily: "IBMPlexSans", color: TINTA },
    rejilla: { flexDirection: "row", flexWrap: "wrap", alignSelf: "center", gap: mm(HUECO_MM) },
    carta: {
      fontSize: mm(2.38),
      backgroundColor: PAPEL,
      borderWidth: mm(0.6),
      borderColor: tema.trim,
      borderRadius: mm(2.5),
      overflow: "hidden",
      flexDirection: "column",
    },
    cabecera: { flexDirection: "row", alignItems: "stretch", gap: mm(0.8), padding: `${mm(1.6)} ${mm(2)} ${mm(1)}` },
    titulo: {
      ...rotulo,
      flexGrow: 1,
      flexShrink: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: mm(2),
      borderTopLeftRadius: mm(0.8),
      borderBottomLeftRadius: mm(0.8),
      backgroundColor: tema.banda,
      color: tema.bandaTexto,
      fontSize: mm(3.4),
      lineHeight: 1.1,
    },
    masHeroe: { marginLeft: mm(1.6), fontWeight: 600, opacity: 0.82 },
    combinada: {
      marginLeft: mm(2),
      paddingVertical: mm(0.3),
      paddingHorizontal: mm(1.4),
      borderWidth: mm(0.3),
      borderColor: tema.realce,
      borderRadius: mm(0.8),
      color: tema.realce,
      fontSize: mm(2.1),
    },
    avatar: {
      width: mm(13),
      minHeight: mm(9.8),
      objectFit: "cover",
      borderWidth: mm(0.45),
      borderColor: tema.banda,
      borderTopLeftRadius: mm(1.2),
      borderBottomRightRadius: mm(1.2),
    },
    atributo: { width: mm(9.5), paddingTop: mm(0.9), paddingBottom: mm(0.7), alignItems: "center", backgroundColor: tema.banda, color: tema.bandaTexto },
    atributoQuest: { width: mm(7.9) },
    atributoUltimo: { borderTopRightRadius: mm(0.8), borderBottomRightRadius: mm(0.8) },
    atributoClave: { ...rotulo, color: tema.realce, fontSize: mm(2), lineHeight: 1.2 },
    atributoValor: { fontWeight: 600, fontSize: mm(3.2), lineHeight: 1.1 },
    cuerpo: { flexGrow: 1, flexDirection: "column" },
    lateral: { paddingHorizontal: mm(2.5) },
    bloque: { marginTop: mm(2.4) },
    bloqueTitulo: { ...rotulo, letterSpacing: mm(0.17), color: TENUE, marginBottom: mm(1) },
    tabla: { borderWidth: mm(0.35), borderColor: tema.trim, borderRadius: mm(1), overflow: "hidden", lineHeight: 1.25 },
    fila: { flexDirection: "row", alignItems: "center" },
    filaCebra: { backgroundColor: CEBRA },
    filaCabeza: { flexDirection: "row", backgroundColor: tema.trim, color: tema.bandaTexto },
    th: { ...rotulo, fontSize: mm(2.2), letterSpacing: mm(0.13) },
    num: { textAlign: "center" },
    arma: { flexDirection: "row", alignItems: "center", gap: mm(1.2) },
    cuenta: { color: TENUE },
    reglasArma: { color: "#575043" },
    chips: { flexDirection: "row", flexWrap: "wrap" },
    chip: {
      fontWeight: 500,
      lineHeight: 1.25,
      backgroundColor: CEBRA,
      borderWidth: mm(0.25),
      borderColor: FILETE,
      borderRadius: mm(0.8),
    },
    chipSinTexto: { borderStyle: "dashed", color: TENUE },
    chipEquipo: { backgroundColor: "transparent" },
    chipIzquierda: { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
    chipConcede: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, backgroundColor: "transparent", color: TENUE },
    chipLiderazgo: { ...rotulo, backgroundColor: tema.trim, borderColor: tema.trim, color: tema.bandaTexto },
    valorChip: { fontWeight: 600 },
    vacio: { color: TENUE },
    mas: { marginTop: mm(0.8), fontSize: mm(2.2), color: TENUE, fontStyle: "italic" },
    notas: { marginTop: mm(1.2), paddingTop: mm(1), paddingHorizontal: mm(2.5), fontSize: mm(2.7), lineHeight: 1.3 },
    etiqueta: { ...rotulo, color: TENUE, fontSize: mm(2.2) },
    par: { flexGrow: 1, flexDirection: "row" },
    columna: { flex: 1, padding: `${mm(1)} ${mm(1.6)} ${mm(0.8)}` },
    columnaSegunda: { borderLeftWidth: mm(0.35), borderLeftColor: FILETE },
    columnaCab: { flexDirection: "row", alignItems: "flex-end", gap: mm(1.4), marginBottom: mm(0.6) },
    columnaNombre: { ...rotulo, flex: 1, fontSize: mm(2.1), color: TENUE },
    columnaMini: { flexDirection: "row", gap: mm(1.1), fontWeight: 600, fontSize: mm(1.8) },
    columnaBloque: { marginTop: mm(0.9) },
    campanaFila: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: mm(1.2), fontSize: mm(2.3), marginBottom: mm(1) },
    campanaCaja: {
      width: mm(10),
      minHeight: mm(5.6),
      borderWidth: mm(0.35),
      borderColor: FILETE,
      borderRadius: mm(1),
      textAlign: "center",
      fontWeight: 600,
      paddingTop: mm(1.2),
    },
    scardCabecera: { flexDirection: "row", alignItems: "stretch", gap: mm(0.5), padding: `${mm(1.1)} ${mm(1.3)} ${mm(0.7)}` },
    scardTitulo: {
      ...rotulo,
      flex: 1,
      justifyContent: "center",
      padding: `${mm(0.8)} ${mm(1.3)}`,
      borderTopLeftRadius: mm(0.6),
      borderBottomLeftRadius: mm(0.6),
      backgroundColor: tema.banda,
      color: tema.bandaTexto,
      fontSize: mm(2.625),
      lineHeight: 1.12,
    },
    scardValor: {
      width: mm(11.25),
      paddingTop: mm(0.7),
      paddingBottom: mm(0.55),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tema.banda,
      color: tema.bandaTexto,
      borderTopRightRadius: mm(0.6),
      borderBottomRightRadius: mm(0.6),
    },
    scardValorClave: { ...rotulo, color: tema.realce, fontSize: mm(1.47), lineHeight: 1.2 },
    scardValorNum: { fontWeight: 600, fontSize: mm(3.675), lineHeight: 1.05 },
    scardCuerpo: { flex: 1, overflow: "hidden", padding: `${mm(1.2)} ${mm(1.8)}` },
    scardEfecto: { fontSize: mm(2.73), lineHeight: 1.32 },
    scardEfectoDenso: { fontSize: mm(2.31), lineHeight: 1.24 },
    scardConcede: { marginTop: mm(1.4), fontSize: mm(2.1), color: TENUE },
    scardSinTexto: { color: TENUE, fontStyle: "italic" },
    scardPie: {
      padding: `${mm(1)} ${mm(1.8)} ${mm(1.3)}`,
      borderTopWidth: mm(0.3),
      borderTopColor: FILETE,
      gap: mm(0.4),
      fontSize: mm(2.7),
      color: TENUE,
    },
    scardFaccion: { ...rotulo, letterSpacing: mm(0.2), color: tema.trim },
    scardTirada: { fontStyle: "italic" },
    dorso: { borderWidth: mm(0.6), borderColor: tema.dorso, borderRadius: mm(2.5), alignItems: "center", justifyContent: "center" },
    dorsoMarco: {
      position: "absolute",
      top: mm(3),
      left: mm(3),
      right: mm(3),
      bottom: mm(3),
      borderWidth: mm(0.35),
      borderColor: tema.dorso,
      borderRadius: mm(1.5),
    },
  });
}
type EstilosCartas = ReturnType<typeof estilosCartas>;

/** El nombre en un solo renglon, recortado con puntos suspensivos antes que
 *  robarle sitio al perfil, como en la carta de pantalla. */
const UN_RENGLON = { maxLines: 1, textOverflow: "ellipsis" as const };

/** Lo que cada pieza de carta necesita saber del conjunto. */
interface Contexto {
  c: EstilosCartas;
  t: Textos;
  tema: Tema;
  ambientacion: Ambientacion;
  glosario: Map<string, CatalogRule>;
}

/** El simbolo de IconoArma: espada para cuerpo a cuerpo y, a distancia,
 *  proyectiles en grimdark o arco en fantasy. */
function IconoArma({ cx, cac }: { cx: Contexto; cac: boolean }) {
  const lado = mm(2.6);
  const color = cx.tema.trim;
  return (
    <Svg width={lado} height={lado} viewBox="0 0 14 14">
      {cac ? (
        <>
          <Path d="M7 0.4 L9.3 5 V8.2 H4.7 V5 Z" fill={color} />
          <Path d="M2.2 8.2 H11.8 V9.9 H2.2 Z" fill={color} />
          <Path d="M6.1 9.9 H7.9 V12.2 H6.1 Z" fill={color} />
          <Circle cx="7" cy="12.8" r="1.2" fill={color} />
        </>
      ) : cx.ambientacion === "fantasy" ? (
        <>
          <Path d="M5.2 0.6 Q0.4 7 5.2 13.4 L6.9 13.4 Q2.5 7 6.9 0.6 Z" fill={color} />
          <Path d="M5.6 0.8 H6.5 V13.2 H5.6 Z" fill={color} />
          <Path d="M4.6 6.2 H10.6 V7.8 H4.6 Z" fill={color} />
          <Path d="M10.2 4.4 L13.6 7 L10.2 9.6 Z" fill={color} />
        </>
      ) : (
        <>
          {[1.4, 5.9, 10.4].map((x) => (
            <Path key={x} d={`M${x} 12.4 V5.2 A1.1 1.1 0 0 1 ${x + 2.2} 5.2 V12.4 Z`} fill={color} />
          ))}
        </>
      )}
    </Svg>
  );
}

/** Una regla o un equipo como en la carta de pantalla: con borde punteado si
 *  no tiene texto en el glosario y, si es un aura, con lo que concede pegado. */
function Chip({ cx, habilidad, arma, m }: { cx: Contexto; habilidad: Habilidad; arma?: boolean; m: Medidas }) {
  const { c, glosario } = cx;
  const tam = arma
    ? { fontSize: mm(m.chipArma), paddingVertical: mm(m.chipArmaV), paddingHorizontal: mm(m.chipArmaH) }
    : { fontSize: mm(m.chip), paddingVertical: mm(m.chipV), paddingHorizontal: mm(m.chipH) };
  const cargado = glosario.size > 0;
  const tieneTexto = !cargado || glosario.has(habilidad.nombre.toLowerCase());
  const aura = cargado
    ? reglaDelAura(habilidad.nombre, glosario.get(habilidad.nombre.toLowerCase())?.description, (nombre) => glosario.has(nombre.toLowerCase()))
    : null;
  const estilo = [c.chip, tam, habilidad.tipo === "equipo" ? c.chipEquipo : {}, tieneTexto ? {} : c.chipSinTexto];
  const texto = (una: Habilidad) => (
    <>
      {una.nombre}
      {una.valor ? <Text style={c.valorChip}>({una.valor})</Text> : null}
    </>
  );
  if (!aura) return <Text style={estilo}>{texto(habilidad)}</Text>;
  return (
    <View style={{ flexDirection: "row" }}>
      <Text style={[...estilo, c.chipIzquierda]}>{texto(habilidad)}</Text>
      <Text style={[c.chip, tam, c.chipConcede]}>→ {texto(aura.concede)}</Text>
    </View>
  );
}

function Chips({ cx, children, m }: { cx: Contexto; children: ReactNode; m: Medidas }) {
  return <View style={[cx.c.chips, { gap: mm(m.hueco) }]}>{children}</View>;
}

function ClusterReglas({ cx, rules, m }: { cx: Contexto; rules: string[]; m: Medidas }) {
  if (rules.length === 0) return <Text style={[cx.c.vacio, { fontSize: mm(m.chip) }]}>{cx.t.ninguna}</Text>;
  return (
    <Chips cx={cx} m={m}>
      {rules.map((rule) => (
        <Chip key={rule} cx={cx} habilidad={parseHabilidad(rule, "regla")} m={m} />
      ))}
    </Chips>
  );
}

function TablaCarta({
  cx,
  m,
  columnas,
  filas,
}: {
  cx: Contexto;
  m: Medidas;
  columnas: Array<{ titulo: string; ancho: string; num?: boolean }>;
  filas: Array<{ key: string; celdas: ReactNode[] }>;
}) {
  const { c } = cx;
  const celda = { paddingVertical: mm(m.celdaV), paddingHorizontal: mm(m.celdaH) };
  return (
    <View style={[c.tabla, { fontSize: mm(m.tabla) }]}>
      <View style={c.filaCabeza}>
        {columnas.map((columna) => (
          <Text key={columna.titulo} style={[c.th, { width: columna.ancho, paddingVertical: mm(0.7), paddingHorizontal: mm(m.celdaH) }, columna.num ? c.num : {}]}>
            {columna.titulo}
          </Text>
        ))}
      </View>
      {filas.map((fila, indice) => (
        <View key={fila.key} style={indice % 2 === 0 ? [c.fila, c.filaCebra] : c.fila}>
          {fila.celdas.map((contenido, columna) => (
            <View key={columnas[columna].titulo} style={[celda, { width: columnas[columna].ancho }]}>
              {typeof contenido === "string" ? <Text style={columnas[columna].num ? c.num : {}}>{contenido}</Text> : contenido}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function TablaArmas({ cx, weapons, max, m, columna }: { cx: Contexto; weapons: LoadoutEntry[]; max: number; m: Medidas; columna?: boolean }) {
  const { c, t } = cx;
  if (weapons.length === 0) return null;
  const visibles = weapons.slice(0, max);
  const ocultas = weapons.length - visibles.length;
  const anchos = columna ? ["34%", "13%", "11%", "42%"] : ["30%", "11%", "9%", "50%"];
  return (
    <View>
      <TablaCarta
        cx={cx}
        m={m}
        columnas={[
          { titulo: t.arma, ancho: anchos[0] },
          { titulo: t.alcance, ancho: anchos[1], num: true },
          { titulo: t.ataques, ancho: anchos[2], num: true },
          { titulo: t.reglasDeArma, ancho: anchos[3] },
        ]}
        filas={visibles.map((weapon, indice) => ({
          key: `${weapon.label}-${indice}`,
          celdas: [
            <View style={c.arma}>
              <IconoArma cx={cx} cac={weapon.range === null} />
              <Text style={{ flex: 1 }}>
                {weapon.count > 1 ? <Text style={c.cuenta}>{weapon.count}× </Text> : null}
                {weapon.name}
              </Text>
            </View>,
            weapon.range === null ? t.cuerpoACuerpo : `${weapon.range}"`,
            weapon.attacks === null ? "—" : `A${weapon.attacks}`,
            weapon.rules.length > 0 ? (
              <View style={c.reglasArma}>
                <Chips cx={cx} m={{ ...m, hueco: Math.min(m.hueco, 0.7) }}>
                  {weapon.rules.map((rule) => (
                    <Chip key={rule} cx={cx} habilidad={parseHabilidad(rule, "regla")} arma m={m} />
                  ))}
                </Chips>
              </View>
            ) : (
              <Text style={c.vacio}>—</Text>
            ),
          ],
        }))}
      />
      {ocultas > 0 ? <Text style={c.mas}>{t.armasOcultas(ocultas)}</Text> : null}
    </View>
  );
}

function TablaEquipo({ cx, gear, m }: { cx: Contexto; gear: LoadoutEntry[]; m: Medidas }) {
  const { c, t } = cx;
  if (gear.length === 0) return null;
  return (
    <TablaCarta
      cx={cx}
      m={m}
      columnas={[
        { titulo: t.equipo, ancho: "38%" },
        { titulo: t.concede, ancho: "62%" },
      ]}
      filas={gear.map((item, indice) => ({
        key: `${item.label}-${indice}`,
        celdas: [
          <Text>
            {item.count > 1 ? <Text style={c.cuenta}>{item.count}× </Text> : null}
            {item.name}
          </Text>,
          item.rules.length > 0 ? (
            <Chips cx={cx} m={m}>
              {item.rules.map((rule) => (
                <Chip key={rule} cx={cx} habilidad={parseHabilidad(rule, "regla")} m={m} />
              ))}
            </Chips>
          ) : (
            <Text style={c.vacio}>—</Text>
          ),
        ],
      }))}
    />
  );
}

function BloqueCarta({ cx, titulo, m, estilo, children }: { cx: Contexto; titulo: string; m: Medidas; estilo?: ComponentProps<typeof View>["style"]; children: ReactNode }) {
  return (
    <View style={estilo ?? [cx.c.bloque, cx.c.lateral]}>
      <Text style={[cx.c.bloqueTitulo, { fontSize: mm(m.titulo) }]}>{titulo}</Text>
      {children}
    </View>
  );
}

const cargaDe = (unit: ResolvedUnit) => ({
  weapons: unit.loadout.filter((entrada) => entrada.kind === "weapon"),
  gear: unit.loadout.filter((entrada) => entrada.kind === "gear"),
});

/** Una columna de la carta emparejada: el perfil completo de un lado, heroe o
 *  unidad, a media anchura. */
function ColumnaPerfil({
  cx,
  perfil,
  segunda,
  aportes = [],
  liderazgo,
}: {
  cx: Contexto;
  perfil: ResolvedUnit;
  segunda?: boolean;
  aportes?: Array<{ nombre: string; concede: Habilidad; alcance: string | null }>;
  liderazgo?: string;
}) {
  const { c, t } = cx;
  const m = MEDIDAS.columna;
  const { weapons, gear } = cargaDe(perfil);
  const separado = { paddingLeft: mm(1.1), borderLeftWidth: mm(0.3), borderLeftColor: FILETE };
  return (
    <View style={segunda ? [c.columna, c.columnaSegunda] : c.columna}>
      <View style={c.columnaCab}>
        <Text style={[c.columnaNombre, UN_RENGLON]}>
          {perfil.name}
        </Text>
        <View style={c.columnaMini}>
          <Text>
            {t.calidad} {perfil.quality}+
          </Text>
          <Text style={separado}>
            {t.defensa} {perfil.defense}+
          </Text>
          <Text style={separado}>
            {t.heridas} {perfil.maxWounds}
          </Text>
        </View>
      </View>
      <View style={c.columnaBloque}>
        <TablaArmas cx={cx} weapons={weapons} max={ARMAS_VISIBLES_COLUMNA} m={m} columna />
      </View>
      <BloqueCarta cx={cx} titulo={t.reglas} m={m} estilo={c.columnaBloque}>
        <ClusterReglas cx={cx} rules={perfil.rules} m={m} />
      </BloqueCarta>
      {gear.length > 0 ? (
        <View style={c.columnaBloque}>
          <TablaEquipo cx={cx} gear={gear} m={m} />
        </View>
      ) : null}
      {liderazgo || aportes.length > 0 ? (
        <BloqueCarta cx={cx} titulo={t.elMandoAporta} m={m} estilo={c.columnaBloque}>
          <Chips cx={cx} m={m}>
            {liderazgo ? (
              <Text style={[c.chip, c.chipLiderazgo, { fontSize: mm(m.chip), paddingVertical: mm(m.chipV), paddingHorizontal: mm(m.chipH) }]}>
                {t.liderazgo} <Text style={{ color: cx.tema.realce }}>{liderazgo}</Text>
              </Text>
            ) : null}
            {aportes.map((aporte) => (
              <View key={aporte.nombre} style={{ flexDirection: "row" }}>
                <Text style={[c.chip, c.chipIzquierda, { fontSize: mm(m.chip), paddingVertical: mm(m.chipV), paddingHorizontal: mm(m.chipH) }]}>
                  {aporte.nombre}
                </Text>
                <Text style={[c.chip, c.chipConcede, { fontSize: mm(m.chip), paddingVertical: mm(m.chipV), paddingHorizontal: mm(m.chipH) }]}>
                  → {aporte.concede.nombre}
                  {aporte.concede.valor ? `(${aporte.concede.valor})` : ""}
                </Text>
              </View>
            ))}
          </Chips>
        </BloqueCarta>
      ) : null}
    </View>
  );
}

/** La carta tarot de una fila del ejercito: la unidad sola, el heroe con la
 *  unidad a la que se ha unido, o el heroe de quest en carta de personaje. */
function CartaUnidad({ cx, fila, quest, avatar }: { cx: Contexto; fila: FilaEjercito; quest: boolean; avatar: string | null }) {
  const { c, t } = cx;
  const unit = fila.principal;
  const adjunta = fila.adjunta;
  const { weapons, gear } = cargaDe(unit);
  const medida = quest ? TAROT_PERSONAJE_MM : TAROT_MM;
  const valor = (clave: string, numero: number | undefined, sufijo = ""): Array<[string, string]> =>
    numero === undefined ? [] : [[clave, `${numero}${sufijo}`]];
  const stats: Array<[string, string]> = quest
    ? [
        [t.calidad, `${unit.quality}+`],
        [t.defensa, `${unit.defense}+`],
        [t.aguante, String(unit.maxWounds)],
        ...valor(t.poder, unit.power),
        ...valor(t.fuerza, unit.strength, "+"),
        ...valor(t.destreza, unit.dexterity, "+"),
        ...valor(t.voluntad, unit.willpower, "+"),
      ]
    : adjunta
      ? [
          [t.miniaturas, String(unit.size + adjunta.size)],
          [t.puntos, String(unit.cost + adjunta.cost)],
        ]
      : [
          [t.miniaturas, String(unit.size)],
          [t.calidad, `${unit.quality}+`],
          [t.defensa, `${unit.defense}+`],
          [t.heridas, String(unit.maxWounds)],
          [t.puntos, String(unit.cost)],
        ];
  const m = adjunta
    ? MEDIDAS[densidad([...weapons, ...cargaDe(adjunta).weapons], [...unit.rules, ...adjunta.rules], [...gear, ...cargaDe(adjunta).gear], true)]
    : quest
      ? { ...MEDIDAS[""], tabla: 2.55 }
      : MEDIDAS[densidad(weapons, unit.rules, gear, false)];

  return (
    <View style={[c.carta, { width: mm(medida.ancho), height: mm(medida.alto) }]}>
      <View style={c.cabecera}>
        <View style={adjunta ? [c.titulo, { fontSize: mm(3) }] : c.titulo}>
          <Text style={[{ flexShrink: 1 }, UN_RENGLON]}>
            {unit.name}
            {adjunta ? <Text style={c.masHeroe}> + {adjunta.name}</Text> : null}
          </Text>
          {unit.combined || adjunta?.combined ? <Text style={c.combinada}>{t.combinada}</Text> : null}
        </View>
        {avatar ? <Image style={c.avatar} src={avatar} /> : null}
        {stats.map(([clave, texto], indice) => (
          <View
            key={clave}
            style={[c.atributo, quest ? c.atributoQuest : {}, indice === stats.length - 1 ? c.atributoUltimo : {}]}
          >
            <Text style={[c.atributoClave, quest ? { fontSize: mm(1.75) } : {}]}>{clave}</Text>
            <Text style={[c.atributoValor, quest ? { fontSize: mm(2.85) } : {}]}>{texto}</Text>
          </View>
        ))}
      </View>

      {adjunta ? (
        <View style={c.par}>
          <ColumnaPerfil cx={cx} perfil={unit} />
          <ColumnaPerfil
            cx={cx}
            perfil={adjunta}
            segunda
            aportes={aportesDelHeroe(unit, unit.loadout, adjunta, cx.glosario)}
            liderazgo={`${unit.quality}+`}
          />
        </View>
      ) : quest ? (
        <View style={[c.cuerpo, c.lateral, { gap: mm(2.4), paddingBottom: mm(2) }]}>
          <TablaArmas cx={cx} weapons={weapons} max={ARMAS_VISIBLES} m={m} />
          <View style={{ flexDirection: "row", gap: mm(3), height: mm(42) }}>
            <View style={{ width: mm(27) }}>
              <Text style={[c.bloqueTitulo, { fontSize: mm(m.titulo) }]}>{t.campana}</Text>
              {[...valor(t.nivel, unit.level), ...valor(t.experiencia, unit.experience), ...valor(t.monedas, unit.gold)].map(([clave, texto]) => (
                <View key={clave} style={c.campanaFila}>
                  <Text style={c.vacio}>{clave}</Text>
                  <Text style={c.campanaCaja}>{texto}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[c.bloqueTitulo, { fontSize: mm(m.titulo) }]}>{t.reglas}</Text>
              <ClusterReglas cx={cx} rules={unit.rules} m={m} />
            </View>
          </View>
          <View style={{ borderTopWidth: mm(0.45), borderTopColor: FILETE, paddingTop: mm(2) }}>
            <Text style={[c.bloqueTitulo, { fontSize: mm(m.titulo) }]}>{t.equipoAdicional}</Text>
            {gear.length > 0 ? <TablaEquipo cx={cx} gear={gear} m={m} /> : <Text style={c.vacio}>{t.sinEquipoAdicional}</Text>}
          </View>
        </View>
      ) : (
        <View style={c.cuerpo}>
          <View style={c.lateral}>
            <TablaArmas cx={cx} weapons={weapons} max={ARMAS_VISIBLES} m={m} />
          </View>
          <BloqueCarta cx={cx} titulo={t.reglas} m={m}>
            <ClusterReglas cx={cx} rules={unit.rules} m={m} />
          </BloqueCarta>
          {gear.length > 0 ? (
            <View style={[c.bloque, c.lateral]}>
              <TablaEquipo cx={cx} gear={gear} m={m} />
            </View>
          ) : null}
        </View>
      )}
      {unit.notes ? (
        <Text style={c.notas}>
          <Text style={c.etiqueta}>{t.notas} </Text>
          {unit.notes}
        </Text>
      ) : null}
    </View>
  );
}

/** Regla, equipo o hechizo en carta Mini Euro: RuleCard y SpellCard. */
function CartaMiniEuroPdf({ cx, carta }: { cx: Contexto; carta: CartaMiniEuro }) {
  const { c, t } = cx;
  const titulo = carta.tipo === "hechizo" ? carta.spell.name : carta.habilidad.nombre;
  const valor = carta.tipo === "hechizo" ? `${carta.spell.threshold}+` : carta.habilidad.valor;
  const texto = carta.tipo === "hechizo" ? carta.spell.effect : carta.tipo === "regla" ? conValor(carta.regla.description, carta.habilidad.valor) : null;
  const concede = carta.tipo === "hechizo" ? null : carta.habilidad.concede?.length ? `${t.concede} ${carta.habilidad.concede.join(", ")}` : null;
  const denso = densidadScard(texto, concede) !== "";
  return (
    <View style={[c.carta, { width: mm(SCARD_MM.ancho), height: mm(SCARD_MM.alto) }]}>
      <View style={c.scardCabecera}>
        <View style={valor ? c.scardTitulo : [c.scardTitulo, { borderTopRightRadius: mm(0.6), borderBottomRightRadius: mm(0.6) }]}>
          <Text>{titulo}</Text>
        </View>
        {valor ? (
          <View style={c.scardValor}>
            <Text style={c.scardValorClave}>{t.valor}</Text>
            <Text style={c.scardValorNum}>{valor}</Text>
          </View>
        ) : null}
      </View>
      <View style={c.scardCuerpo}>
        {texto ? (
          <>
            <Text style={denso ? c.scardEfectoDenso : c.scardEfecto}>{texto}</Text>
            {concede ? <Text style={[c.scardConcede, denso ? { fontSize: mm(1.84) } : {}]}>{concede}</Text> : null}
          </>
        ) : concede ? (
          <Text style={denso ? c.scardEfectoDenso : c.scardEfecto}>{concede}.</Text>
        ) : (
          <Text style={[c.scardEfecto, c.scardSinTexto]}>{t.sinTexto}</Text>
        )}
      </View>
      <View style={c.scardPie}>
        {carta.tipo === "hechizo" ? (
          <>
            {carta.faccion ? <Text style={c.scardFaccion}>{carta.faccion}</Text> : null}
            <Text style={c.scardTirada}>{t.tirada(carta.spell.threshold)}</Text>
          </>
        ) : (
          <>
            <Text style={c.scardFaccion}>{carta.tipo === "equipo" ? t.equipo : t.reglaEspecial}</Text>
            {carta.tipo === "equipo" && carta.lleva.length > 0 ? <Text style={c.scardTirada}>{t.loLlevan(carta.lleva)}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

/** El reverso de una carta: solo trazo, sin relleno, para que salga en papel
 *  aunque no se impriman los fondos. */
function Dorso({ cx, ancho, alto, vacio }: { cx: Contexto; ancho: number; alto: number; vacio: boolean }) {
  if (vacio) return <View style={{ width: mm(ancho), height: mm(alto) }} />;
  const lado = mm(7);
  return (
    <View style={[cx.c.dorso, { width: mm(ancho), height: mm(alto) }]}>
      <View style={cx.c.dorsoMarco} />
      <Svg width={lado} height={lado} viewBox="0 0 10 10">
        <Path d="M5 0 Q5.6 4.4 10 5 Q5.6 5.6 5 10 Q4.4 5.6 0 5 Q4.4 4.4 5 0 Z" fill={cx.tema.dorso} />
      </Svg>
    </View>
  );
}

/** Un mazo en hojas: cada anverso seguido de su reverso con las columnas en
 *  espejo, centrados y con el margen de arriba fijo para que casen. */
function Mazo<T extends { key: string }>({
  cx,
  items,
  medida,
  apaisada,
  pintar,
}: {
  cx: Contexto;
  items: T[];
  medida: { ancho: number; alto: number };
  apaisada: boolean;
  pintar: (item: T) => ReactNode;
}) {
  const { columnas, filas } = cuadriculaPorHoja(medida.ancho, medida.alto, apaisada);
  const ancho = mm(columnas * medida.ancho + (columnas - 1) * HUECO_MM);
  const orientacion = apaisada ? "landscape" : "portrait";
  return (
    <>
      {trocear(items, columnas * filas).flatMap((hoja, indice) => [
        <Page key={`anverso-${indice}`} size="A4" orientation={orientacion} style={cx.c.hoja}>
          <View style={[cx.c.rejilla, { width: ancho }]}>{hoja.map((item) => <View key={item.key}>{pintar(item)}</View>)}</View>
        </Page>,
        <Page key={`reverso-${indice}`} size="A4" orientation={orientacion} style={cx.c.hoja}>
          <View style={[cx.c.rejilla, { width: ancho }]}>
            {espejarHoja(hoja, columnas).map((item, celda) => (
              <Dorso key={item?.key ?? `vacio-${celda}`} cx={cx} ancho={medida.ancho} alto={medida.alto} vacio={!item} />
            ))}
          </View>
        </Page>,
      ])}
    </>
  );
}

function tarjetas(
  { nombre, noun, quest, units, entradasAttachedTo, glosario, librosConocidos, puedeLanzarHechizos, t, ambientacion }: OpcionesPdfEjercito,
  avatarDe: (unit: ResolvedUnit) => string | null,
) {
  const tema = TEMAS[ambientacion];
  const cx: Contexto = { c: estilosCartas(tema), t, tema, ambientacion, glosario };
  const filas = emparejarHeroes(units, entradasAttachedTo);
  const cartas = cartasDe(glosario, units, librosConocidos, puedeLanzarHechizos);
  return (
    <Document title={nombre || noun.singular}>
      {/* Una carta tipo tarot es mas ancha que alta: en hoja apaisada caben
          cuatro en vez de tres. */}
      <Mazo
        cx={cx}
        items={filas}
        medida={quest ? TAROT_PERSONAJE_MM : TAROT_MM}
        apaisada
        pintar={(fila) => <CartaUnidad cx={cx} fila={fila} quest={quest} avatar={avatarDe(fila.principal)} />}
      />
      <Mazo cx={cx} items={cartas} medida={SCARD_MM} apaisada={false} pintar={(carta) => <CartaMiniEuroPdf cx={cx} carta={carta} />} />
      {/* Un PDF sin paginas no se abre: sin nada que imprimir, se dice. */}
      {filas.length === 0 && cartas.length === 0 ? (
        <Page size="A4" style={cx.c.hoja}>
          <Text style={{ textAlign: "center", fontSize: mm(4) }}>{t.sinUnidades(noun)}</Text>
        </Page>
      ) : null}
    </Document>
  );
}
