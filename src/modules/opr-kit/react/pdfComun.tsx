import { Children } from "react";
import type { ReactNode } from "react";
import { Font, Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import type { CatalogRule } from "../core/model";
import type { ResolvedUnit } from "../core/armyForgeResolve";
import { optionCost } from "../core/builder";
import type { UpgradeOption, UpgradeSection } from "../core/builder";
import type { LoadoutEntry } from "../core/loadout";
import { desglosarOpcion } from "../core/opciones";
import { conValor, parseHabilidad } from "../core/reglas";
import { reglasMencionadasEnHechizos } from "../core/spells";
import type { Spell } from "../core/spells";
import { PAGINA_MM } from "../core/print";
import type { Textos } from "./textos";
import { aportesDelHeroe } from "./UnitCard";

/**
 * Lo comun a los PDF de faccion y de ejercito, dibujados como texto con
 * react-pdf: se pueden seleccionar y buscar, pesan cientos de KB y salen en
 * segundos. Las medidas y los colores son los de `.ucard`, `.scard` y
 * `.libro-*` en styles.css: si se tocan alli, hay que tocarlos aqui.
 */

const PT_POR_MM = 72 / 25.4;
export const mm = (valor: number) => valor * PT_POR_MM;
export const ALTO_UTIL_MM = PAGINA_MM.alto - PAGINA_MM.margen * 2;

/** Los colores de `.ucard` en styles.css, por ambientacion. */
export const TEMAS = {
  grimdark: {
    trim: "#4e5a63",
    banda: "#14181f",
    bandaTexto: "#f5f0e4",
    realce: "#f2a71b",
    dorso: "#47525a",
    rotulo: "SairaCondensed",
    mayusculas: true,
    lectura: "IBMPlexSans",
  },
  fantasy: {
    trim: "#8a7550",
    banda: "#2b2013",
    bandaTexto: "#f2e6c9",
    realce: "#a97e2e",
    dorso: "#977f4f",
    rotulo: "AlegreyaSC",
    mayusculas: false,
    lectura: "AlegreyaSans",
  },
};
export type Ambientacion = keyof typeof TEMAS;
export type Tema = (typeof TEMAS)[Ambientacion];

export const TINTA = "#201a12";
export const PAPEL = "#f4efe3";
export const CEBRA = "#ebe5d7";
export const TENUE = "#7c7361";
export const FILETE = "#d3ccb9";

/** La ambientacion que esta pintando la aplicacion. */
export function ambientacionActual(): Ambientacion {
  return document.documentElement.dataset.setting === "fantasy" ? "fantasy" : "grimdark";
}

let fuentesRegistradas = false;

/** Las fuentes van alojadas con la aplicacion, en TTF: react-pdf no lee
 *  WOFF2, y asi el PDF no depende de Google Fonts. Solo se incrusta en el PDF
 *  lo que se usa de cada una. */
export function registrarFuentes() {
  if (fuentesRegistradas) return;
  fuentesRegistradas = true;
  const base = `${import.meta.env.BASE_URL}fonts/pdf/`;
  const fuente = (familia: string, variantes: Array<[number, "normal" | "italic"]>) =>
    Font.register({
      family: familia,
      fonts: variantes.map(([fontWeight, fontStyle]) => ({
        src: `${base}${familia}-${fontWeight}${fontStyle === "italic" ? "-italic" : ""}.ttf`,
        fontWeight,
        fontStyle,
      })),
    });
  fuente("IBMPlexSans", [[400, "normal"], [400, "italic"], [500, "normal"], [600, "normal"]]);
  fuente("SairaCondensed", [[600, "normal"], [700, "normal"]]);
  fuente("AlegreyaSC", [[700, "normal"]]);
  fuente("AlegreyaSans", [[400, "normal"], [400, "italic"], [700, "normal"]]);
  // Sin partir palabras con guiones: react-pdf lo hace en ingles por defecto.
  Font.registerHyphenationCallback((palabra) => [palabra]);
}

/** El estilo de los rotulos: la fuente de banda del tema, en versales o no. */
export function rotuloDe(tema: Tema) {
  return {
    fontFamily: tema.rotulo,
    fontWeight: 700,
    textTransform: tema.mayusculas ? ("uppercase" as const) : ("none" as const),
  };
}

/** Las piezas del modo libro: pagina A4, titulos y la ficha de `.libro-*`. */
export function estilosDe(tema: Tema) {
  const rotulo = rotuloDe(tema);
  return StyleSheet.create({
    pagina: {
      paddingTop: mm(PAGINA_MM.margen),
      paddingBottom: mm(PAGINA_MM.margen + 4),
      paddingHorizontal: mm(PAGINA_MM.margen),
      fontFamily: "IBMPlexSans",
      fontSize: mm(2.65),
      lineHeight: 1.28,
      color: TINTA,
    },
    pie: {
      position: "absolute",
      // Con `bottom`, react-pdf se descuadra en libros largos y falla al escribir el PDF.
      top: mm(PAGINA_MM.alto - PAGINA_MM.margen + 1),
      left: mm(PAGINA_MM.margen),
      right: mm(PAGINA_MM.margen),
      textAlign: "center",
      color: TENUE,
      fontSize: mm(2.4),
    },
    titulo: {
      ...rotulo,
      fontSize: mm(8),
      lineHeight: 1,
      paddingTop: mm(4),
      paddingBottom: mm(2),
      borderBottomWidth: mm(0.5),
      borderBottomColor: TINTA,
      marginBottom: mm(4),
    },
    subtitulo: { fontSize: mm(4.5), fontWeight: 600, marginTop: mm(-2.5) },
    resumen: { fontSize: mm(3.4), marginTop: mm(1), marginBottom: mm(4) },
    portada: { width: "100%", maxHeight: mm(200), objectFit: "cover", borderRadius: mm(2) },
    lore: { fontFamily: tema.lectura, fontSize: mm(3.2), lineHeight: 1.35 },
    loreParrafo: { marginBottom: mm(2.2) },
    loreTitulo: { ...rotulo, fontSize: mm(4.2), marginTop: mm(2), marginBottom: mm(1.5) },
    negrita: { fontWeight: tema.lectura === "IBMPlexSans" ? 600 : 700 },
    cursiva: { fontStyle: "italic" },
    cita: { paddingLeft: mm(3), borderLeftWidth: mm(0.6), borderLeftColor: tema.realce, color: TENUE },
    ficha: {
      backgroundColor: PAPEL,
      borderWidth: mm(0.6),
      borderColor: tema.trim,
      borderRadius: mm(2.5),
      paddingBottom: mm(2.6),
      marginBottom: mm(2),
      overflow: "hidden",
    },
    fichaOpciones: { marginLeft: mm(8) },
    unidad: { marginBottom: mm(2) },
    cabecera: { flexDirection: "row", alignItems: "stretch", padding: `${mm(1.6)} ${mm(2)} ${mm(1)}` },
    cabeceraConMiniatura: { alignItems: "flex-end", minHeight: mm(33), paddingTop: mm(2) },
    nombre: {
      ...rotulo,
      flexGrow: 1,
      flexShrink: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      paddingHorizontal: mm(2),
      paddingVertical: mm(1.2),
      borderTopLeftRadius: mm(0.8),
      borderBottomLeftRadius: mm(0.8),
      backgroundColor: tema.banda,
      color: tema.bandaTexto,
      fontSize: mm(3.4),
      lineHeight: 1.1,
    },
    nombreConMiniatura: { minHeight: mm(12) },
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
    separador: { color: TENUE },
    avatar: {
      width: mm(13),
      marginLeft: mm(0.8),
      objectFit: "cover",
      borderWidth: mm(0.45),
      borderColor: tema.banda,
      borderTopLeftRadius: mm(1.2),
      borderBottomRightRadius: mm(1.2),
    },
    atributo: {
      width: mm(9.5),
      marginLeft: mm(0.8),
      paddingTop: mm(0.9),
      paddingBottom: mm(0.7),
      alignItems: "center",
      backgroundColor: tema.banda,
      color: tema.bandaTexto,
    },
    atributoUltimo: { borderTopRightRadius: mm(0.8), borderBottomRightRadius: mm(0.8) },
    atributoClave: { ...rotulo, color: tema.realce, fontSize: mm(2), lineHeight: 1.2 },
    atributoValor: { fontWeight: 600, fontSize: mm(3.2), lineHeight: 1.1 },
    miniatura: { position: "absolute", top: 0, left: "50%", width: "50%", height: mm(40), objectFit: "cover", objectPosition: "top" },
    meta: { flexDirection: "row", flexWrap: "wrap", gap: mm(2), marginTop: mm(1.2) },
    metaPastilla: {
      paddingVertical: mm(0.3),
      paddingHorizontal: mm(1.2),
      borderWidth: mm(0.3),
      borderColor: FILETE,
      borderRadius: mm(2),
      color: TENUE,
      fontSize: mm(2.5),
      fontWeight: 600,
    },
    cuerpo: { paddingTop: mm(2.2), paddingHorizontal: mm(2.5), gap: mm(2.2) },
    loreUnidad: {
      width: "50%",
      paddingVertical: mm(1.6),
      paddingHorizontal: mm(2),
      borderLeftWidth: mm(0.6),
      borderLeftColor: tema.realce,
      backgroundColor: `${tema.realce}1a`,
      color: TENUE,
      fontSize: mm(2.75),
      lineHeight: 1.28,
    },
    notas: { fontSize: mm(2.7) },
    etiqueta: { ...rotulo, color: TENUE, fontSize: mm(2.2) },
    bloqueTitulo: { ...rotulo, fontSize: mm(2.2), lineHeight: 1.2, letterSpacing: mm(0.18), marginBottom: mm(1), color: TENUE },
    tabla: { borderWidth: mm(0.35), borderColor: tema.trim, borderRadius: mm(1), overflow: "hidden" },
    fila: { flexDirection: "row" },
    filaCebra: { backgroundColor: CEBRA },
    filaCabeza: { flexDirection: "row", backgroundColor: tema.trim, color: tema.bandaTexto },
    th: { ...rotulo, fontSize: mm(2.2), letterSpacing: mm(0.13), padding: `${mm(0.7)} ${mm(1.4)}` },
    td: { padding: `${mm(0.7)} ${mm(1.4)}` },
    colNombre: { fontWeight: 600 },
    num: { textAlign: "center" },
    vacio: { color: TENUE },
    reglaParrafo: { marginBottom: mm(1) },
    par: { flexDirection: "row", gap: mm(2.5) },
    parColumna: { flex: 1, gap: mm(1.6) },
    parNombre: { ...rotulo, fontSize: mm(3) },
    parPerfil: { color: TENUE, fontWeight: 600 },
    seccion: { ...rotulo, fontSize: mm(5.5), marginTop: mm(2), marginBottom: mm(3) },
  });
}
export type Estilos = ReturnType<typeof estilosDe>;

/** El pie de cada pagina: lo que es el documento y el numero de pagina. */
export function Pie({ s, texto }: { s: Estilos; texto: string }) {
  return <Text style={s.pie} fixed render={({ pageNumber }) => `${texto} · ${pageNumber}`} />;
}

/** Una columna de tabla: cuanto se lleva del ancho y si va centrada. */
export interface Columna {
  titulo: string;
  ancho: string;
  num?: boolean;
}

/** react-pdf no tiene tablas: filas de `View` con anchos fijos por columna,
 *  repartidos como en papel. Una fila no se parte entre paginas, y si la
 *  tabla si, la cabecera se repite arriba. */
export function Tabla({ s, columnas, filas }: { s: Estilos; columnas: Columna[]; filas: Array<{ key: string; celdas: ReactNode[] }> }) {
  return (
    <View style={s.tabla}>
      <View style={s.filaCabeza} wrap={false} fixed>
        {columnas.map((columna) => (
          <Text key={columna.titulo} style={[s.th, { width: columna.ancho }, columna.num ? s.num : {}]}>
            {columna.titulo}
          </Text>
        ))}
      </View>
      {filas.map((fila, indice) => (
        <View key={fila.key} style={indice % 2 === 0 ? [s.fila, s.filaCebra] : s.fila} wrap={false}>
          {fila.celdas.map((celda, columna) => (
            <View key={columnas[columna].titulo} style={[s.td, { width: columnas[columna].ancho }]}>
              {typeof celda === "string" ? (
                <Text style={[columna === 0 ? s.colNombre : {}, columnas[columna].num ? s.num : {}]}>{celda}</Text>
              ) : (
                celda
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Bloque({ s, titulo, children }: { s: Estilos; titulo: string; children: ReactNode }) {
  return (
    <View>
      <Text style={s.bloqueTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

/** El nombre tal como se escribe (con su valor) y el texto de su
 *  descripcion, ya con el valor metido donde el glosario pone una X. Sin
 *  descripcion no hay fila vacia: se deja en null y quien pinta decide. */
export function textoDeRegla(etiqueta: string, glosario: Map<string, CatalogRule>): { nombre: string; texto: string | null } {
  const habilidad = parseHabilidad(etiqueta, "regla");
  const regla = glosario.get(habilidad.nombre.toLowerCase());
  return { nombre: habilidad.etiqueta, texto: regla?.description ? conValor(regla.description, habilidad.valor) : null };
}

/** Una regla por parrafo, nombre en negrita seguido del texto: es lo que va
 *  en la columna ancha de armas y equipo, que puede llevar varias reglas. */
function ReglasTexto({ s, etiquetas, glosario }: { s: Estilos; etiquetas: string[]; glosario: Map<string, CatalogRule> }) {
  if (etiquetas.length === 0) return <Text style={s.vacio}>—</Text>;
  return (
    <>
      {etiquetas.map((etiqueta) => {
        const { nombre, texto } = textoDeRegla(etiqueta, glosario);
        return (
          <Text key={etiqueta} style={s.reglaParrafo}>
            <Text style={s.colNombre}>{nombre}</Text>
            {texto ? `: ${texto}` : ""}
          </Text>
        );
      })}
    </>
  );
}

/** Solo las etiquetas que sabe pintar: el resto se deshace en su texto. */
function componentesMarkdown(s: Estilos): Components {
  const bloques = (children: ReactNode) => Children.toArray(children).filter((hijo) => typeof hijo !== "string" || hijo.trim());
  return {
    p: ({ children }) => <Text style={s.loreParrafo}>{children}</Text>,
    h1: ({ children }) => <Text style={s.loreTitulo}>{children}</Text>,
    h2: ({ children }) => <Text style={s.loreTitulo}>{children}</Text>,
    h3: ({ children }) => <Text style={s.loreTitulo}>{children}</Text>,
    h4: ({ children }) => <Text style={s.loreTitulo}>{children}</Text>,
    strong: ({ children }) => <Text style={s.negrita}>{children}</Text>,
    em: ({ children }) => <Text style={s.cursiva}>{children}</Text>,
    ul: ({ children }) => <View style={s.loreParrafo}>{bloques(children)}</View>,
    ol: ({ children }) => <View style={s.loreParrafo}>{bloques(children)}</View>,
    li: ({ children }) => <Text>• {bloques(children)}</Text>,
    blockquote: ({ children }) => <View style={s.cita}>{bloques(children)}</View>,
    br: () => <Text>{"\n"}</Text>,
  };
}
const ETIQUETAS_MARKDOWN = ["p", "h1", "h2", "h3", "h4", "strong", "em", "ul", "ol", "li", "blockquote", "br"];

/** Markdown deja saltos de linea sueltos entre bloques, y react-pdf no admite
 *  texto fuera de un `Text`: se quedan fuera. */
export function Lore({ s, texto, estilo }: { s: Estilos; texto: string; estilo: Estilos[keyof Estilos] }) {
  const arbol = Markdown({ children: texto, components: componentesMarkdown(s), allowedElements: ETIQUETAS_MARKDOWN, unwrapDisallowed: true });
  const bloques = Children.toArray((arbol as { props: { children: ReactNode } }).props.children).filter((hijo) => typeof hijo !== "string");
  return <View style={estilo}>{bloques}</View>;
}

/** Lo que la ficha de libro necesita de una unidad: el perfil ya resuelto. */
export type PerfilLibro = Pick<ResolvedUnit, "name" | "size" | "quality" | "defense" | "cost" | "rules" | "loadout" | "combined" | "notes"> & {
  maxWounds?: number;
};

function lineasDeTexto(texto: string | null | undefined, caracteresPorLinea: number): number {
  if (!texto) return 1;
  return Math.max(1, Math.ceil(texto.length / caracteresPorLinea));
}

function lineasDeReglas(etiquetas: string[], glosario: Map<string, CatalogRule>): number {
  if (etiquetas.length === 0) return 1;
  return etiquetas.reduce((total, etiqueta) => total + lineasDeTexto(textoDeRegla(etiqueta, glosario).texto, 92), 0);
}

/** Lo que medira la ficha en papel, a ojo: solo hace falta saber si cabe en
 *  una pagina, para no partirla si cabe. */
export function altoLibroEstimadoMm(unit: PerfilLibro, glosario: Map<string, CatalogRule>, hechizos: Spell[]): number {
  const armas = unit.loadout.filter((entrada) => entrada.kind === "weapon");
  const equipo = unit.loadout.filter((entrada) => entrada.kind === "gear");
  const filasArmas = armas.reduce((total, arma) => total + lineasDeReglas(arma.rules, glosario), 0);
  const filasReglas = unit.rules.reduce((total, etiqueta) => total + lineasDeTexto(textoDeRegla(etiqueta, glosario).texto, 100), 0);
  const filasEquipo = equipo.reduce((total, item) => total + lineasDeReglas(item.rules, glosario), 0);
  const filasHechizos = hechizos.reduce((total, spell) => total + lineasDeTexto(spell.effect, 100), 0);
  return 22 + armas.length * 8 + filasArmas * 4.1 + unit.rules.length * 7 + filasReglas * 4.1 + equipo.length * 7 + filasEquipo * 4.1 + hechizos.length * 7 + filasHechizos * 4.1 + (unit.notes ? lineasDeTexto(unit.notes, 110) * 4.1 + 8 : 0);
}

/** El nombre con sus miniaturas si son varias: "Battle Brothers (5)". */
const nombreConTamano = (unit: PerfilLibro) => `${unit.name}${unit.size > 1 ? ` (${unit.size})` : ""}`;

function Cabecera({
  s,
  t,
  nombre,
  combinada,
  atributos,
  miniatura,
  avatar,
}: {
  s: Estilos;
  t: Textos;
  nombre: string;
  combinada: boolean;
  atributos: Array<[string, string]>;
  miniatura: boolean;
  avatar: string | null;
}) {
  return (
    <View style={miniatura ? [s.cabecera, s.cabeceraConMiniatura] : s.cabecera}>
      <View style={miniatura ? [s.nombre, s.nombreConMiniatura] : s.nombre}>
        <Text>{nombre}</Text>
        {combinada ? <Text style={s.combinada}>{t.combinada}</Text> : null}
      </View>
      {avatar ? <Image style={s.avatar} src={avatar} /> : null}
      {atributos.map(([clave, valor], indice) => (
        <View key={clave} style={indice === atributos.length - 1 ? [s.atributo, s.atributoUltimo] : s.atributo}>
          <Text style={s.atributoClave}>{clave}</Text>
          <Text style={s.atributoValor}>{valor}</Text>
        </View>
      ))}
    </View>
  );
}

export function TablaHechizos({ s, t, hechizos }: { s: Estilos; t: Textos; hechizos: Spell[] }) {
  return (
    <Tabla
      s={s}
      columnas={[
        { titulo: t.hechizo, ancho: "24%" },
        { titulo: t.valor, ancho: "10%", num: true },
        { titulo: t.efecto, ancho: "66%" },
      ]}
      filas={hechizos.map((spell) => ({ key: spell.key, celdas: [spell.name, `${spell.threshold}+`, spell.effect] }))}
    />
  );
}

/**
 * La ficha de libro de una unidad: perfil, armas, reglas con su texto, equipo,
 * hechizos y notas. No se parte entre paginas salvo que no quepa en una; en
 * ese caso fluye a la siguiente fila a fila, con la cabecera de cada tabla
 * repetida arriba.
 */
export function FichaUnidadPdf({
  s,
  t,
  unit,
  glosario,
  hechizos,
  miniatura = null,
  avatar = null,
  lore,
}: {
  s: Estilos;
  t: Textos;
  unit: PerfilLibro;
  glosario: Map<string, CatalogRule>;
  hechizos: Spell[];
  miniatura?: string | null;
  avatar?: string | null;
  lore?: string | null;
}) {
  const armas = unit.loadout.filter((entrada) => entrada.kind === "weapon");
  const equipo = unit.loadout.filter((entrada) => entrada.kind === "gear");
  const yaTiene = (nombre: string) => unit.rules.some((regla) => parseHabilidad(regla, "regla").nombre.toLowerCase() === nombre.toLowerCase());
  const reglas = [...unit.rules, ...reglasMencionadasEnHechizos(glosario, hechizos).map((regla) => regla.name).filter((nombre) => !yaTiene(nombre))];
  const atributos: Array<[string, string]> = [
    [t.calidad, `${unit.quality}+`],
    [t.defensa, `${unit.defense}+`],
    ...(unit.maxWounds !== undefined ? ([[t.heridas, String(unit.maxWounds)]] as Array<[string, string]>) : []),
    [t.puntos, String(unit.cost)],
  ];
  const reglasDe = (entradas: LoadoutEntry[]) =>
    entradas.map((entrada, indice) => ({ key: `${entrada.name}-${indice}`, entrada, reglas: <ReglasTexto s={s} etiquetas={entrada.rules} glosario={glosario} /> }));
  const cabeEnUnaPagina = altoLibroEstimadoMm(unit, glosario, hechizos) <= ALTO_UTIL_MM;

  return (
    <View style={s.ficha} wrap={!cabeEnUnaPagina}>
      {miniatura ? <Image style={s.miniatura} src={miniatura} /> : null}
      <Cabecera
        s={s}
        t={t}
        nombre={nombreConTamano(unit)}
        combinada={Boolean(unit.combined)}
        atributos={atributos}
        miniatura={Boolean(miniatura)}
        avatar={avatar}
      />
      <View style={s.cuerpo}>
        {lore ? <Lore s={s} texto={lore} estilo={s.loreUnidad} /> : null}
        {armas.length > 0 ? (
          <Bloque s={s} titulo={t.armas}>
            <Tabla
              s={s}
              columnas={[
                { titulo: t.arma, ancho: "24%" },
                { titulo: t.alcance, ancho: "10%", num: true },
                { titulo: t.ataques, ancho: "10%", num: true },
                { titulo: t.reglas, ancho: "56%" },
              ]}
              filas={reglasDe(armas).map(({ key, entrada, reglas: texto }) => ({
                key,
                celdas: [
                  `${entrada.count > 1 ? `${entrada.count}× ` : ""}${entrada.name}`,
                  entrada.range ? `${entrada.range}"` : t.cuerpoACuerpo,
                  `A${entrada.attacks}`,
                  texto,
                ],
              }))}
            />
          </Bloque>
        ) : null}
        {reglas.length > 0 ? <BloqueReglas s={s} t={t} reglas={reglas} glosario={glosario} /> : null}
        {equipo.length > 0 ? (
          <Bloque s={s} titulo={t.equipo}>
            <Tabla
              s={s}
              columnas={[
                { titulo: t.equipo, ancho: "24%" },
                { titulo: t.concede, ancho: "76%" },
              ]}
              filas={reglasDe(equipo).map(({ key, entrada, reglas: texto }) => ({
                key,
                celdas: [`${entrada.count > 1 ? `${entrada.count}× ` : ""}${entrada.name}`, texto],
              }))}
            />
          </Bloque>
        ) : null}
        {hechizos.length > 0 ? (
          <Bloque s={s} titulo={t.hechizos}>
            <TablaHechizos s={s} t={t} hechizos={hechizos} />
          </Bloque>
        ) : null}
        {unit.notes ? (
          <Text style={s.notas}>
            <Text style={s.etiqueta}>{t.notas} </Text>
            {unit.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Las reglas con su texto a todo lo ancho, una por fila. El matiz va tras el
 *  nombre, entre parentesis: de quien es la regla en la ficha del par. */
function BloqueReglas({
  s,
  t,
  reglas,
  glosario,
  matizDe,
}: {
  s: Estilos;
  t: Textos;
  reglas: string[];
  glosario: Map<string, CatalogRule>;
  matizDe?: (etiqueta: string) => string | null;
}) {
  return (
    <Bloque s={s} titulo={t.reglas}>
      <Tabla
        s={s}
        columnas={[
          { titulo: t.regla, ancho: "24%" },
          { titulo: t.texto, ancho: "76%" },
        ]}
        filas={reglas.map((etiqueta) => {
          const { nombre, texto } = textoDeRegla(etiqueta, glosario);
          const matiz = matizDe?.(etiqueta);
          return {
            key: etiqueta,
            celdas: [
              matiz ? (
                <Text style={s.colNombre}>
                  {nombre} <Text style={s.vacio}>({matiz})</Text>
                </Text>
              ) : (
                nombre
              ),
              texto ?? <Text style={s.vacio}>—</Text>,
            ],
          };
        })}
      />
    </Bloque>
  );
}

/** Las etiquetas sin repetir, en el orden en que llegan. */
function sinRepetir(etiquetas: string[]): string[] {
  const vistas = new Set<string>();
  return etiquetas.filter((etiqueta) => {
    const clave = etiqueta.trim().toLowerCase();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

/** Lo que el heroe le presta a la unidad mientras van unidos. */
const aportesDelPar = (heroe: PerfilLibro, unidad: PerfilLibro, glosario: Map<string, CatalogRule>) =>
  aportesDelHeroe(heroe, heroe.loadout, unidad, glosario);

/** Todas las reglas del par, sin repetir: las propias de cada uno, las de sus
 *  armas y equipo, las que el heroe presta a la unidad y las que mencionan
 *  sus hechizos. */
function reglasDelPar(heroe: PerfilLibro, unidad: PerfilLibro, glosario: Map<string, CatalogRule>, hechizos: Spell[]): string[] {
  return sinRepetir([
    ...heroe.rules,
    ...unidad.rules,
    ...[...heroe.loadout, ...unidad.loadout].flatMap((entrada) => entrada.rules),
    ...aportesDelPar(heroe, unidad, glosario).map((aporte) => aporte.concede.etiqueta),
    ...reglasMencionadasEnHechizos(glosario, hechizos).map((regla) => regla.name),
  ]);
}

/** Lo que medira la ficha del par, a ojo y por lo alto: como si heroe y unidad
 *  fueran una sola ficha, aunque sus tablas vayan lado a lado. */
export function altoParEstimadoMm(heroe: PerfilLibro, unidad: PerfilLibro, glosario: Map<string, CatalogRule>, hechizos: Spell[]): number {
  return altoLibroEstimadoMm(
    {
      ...heroe,
      rules: reglasDelPar(heroe, unidad, glosario, hechizos),
      loadout: [...heroe.loadout, ...unidad.loadout],
      notes: [heroe.notes, unidad.notes].filter(Boolean).join(" "),
    },
    glosario,
    hechizos,
  );
}

/** Media ficha del par: perfil, reglas, armas y equipo de uno de los dos, con
 *  las reglas solo nombradas. Su texto va debajo, a todo lo ancho. */
function ColumnaPar({ s, t, unit }: { s: Estilos; t: Textos; unit: PerfilLibro }) {
  const armas = unit.loadout.filter((entrada) => entrada.kind === "weapon");
  const equipo = unit.loadout.filter((entrada) => entrada.kind === "gear");
  const nombreEntrada = (entrada: LoadoutEntry) => `${entrada.count > 1 ? `${entrada.count}× ` : ""}${entrada.name}`;
  const etiquetas = (entrada: LoadoutEntry) => (entrada.rules.length > 0 ? entrada.rules.join(", ") : <Text style={s.vacio}>—</Text>);
  return (
    <View style={s.parColumna}>
      <View>
        <Text style={s.parNombre}>{nombreConTamano(unit)}</Text>
        <Text style={s.parPerfil}>
          {[
            `${t.calidad} ${unit.quality}+`,
            `${t.defensa} ${unit.defense}+`,
            ...(unit.maxWounds !== undefined ? [`${t.heridas} ${unit.maxWounds}`] : []),
            `${t.puntos} ${unit.cost}`,
          ].join(" · ")}
        </Text>
        {unit.rules.length > 0 ? <Text>{unit.rules.join(", ")}</Text> : null}
      </View>
      {armas.length > 0 ? (
        <Tabla
          s={s}
          columnas={[
            { titulo: t.arma, ancho: "36%" },
            { titulo: t.alcance, ancho: "14%", num: true },
            { titulo: t.ataques, ancho: "14%", num: true },
            { titulo: t.reglas, ancho: "36%" },
          ]}
          filas={armas.map((entrada, indice) => ({
            key: `${entrada.name}-${indice}`,
            celdas: [nombreEntrada(entrada), entrada.range ? `${entrada.range}"` : t.cuerpoACuerpo, `A${entrada.attacks}`, etiquetas(entrada)],
          }))}
        />
      ) : null}
      {equipo.length > 0 ? (
        <Tabla
          s={s}
          columnas={[
            { titulo: t.equipo, ancho: "50%" },
            { titulo: t.concede, ancho: "50%" },
          ]}
          filas={equipo.map((entrada, indice) => ({ key: `${entrada.name}-${indice}`, celdas: [nombreEntrada(entrada), etiquetas(entrada)] }))}
        />
      ) : null}
      {unit.notes ? (
        <Text style={s.notas}>
          <Text style={s.etiqueta}>{t.notas} </Text>
          {unit.notes}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * La ficha de libro de un heroe unido a una unidad, como su carta: el heroe a
 * la izquierda y la unidad a la derecha, y debajo, a todo lo ancho, el texto
 * de todas las reglas de los dos y los hechizos. Se parte entre paginas igual
 * que la ficha de una unidad.
 */
export function FichaParPdf({
  s,
  t,
  heroe,
  unidad,
  glosario,
  hechizos,
  avatar = null,
}: {
  s: Estilos;
  t: Textos;
  heroe: PerfilLibro;
  unidad: PerfilLibro;
  glosario: Map<string, CatalogRule>;
  hechizos: Spell[];
  avatar?: string | null;
}) {
  const reglas = reglasDelPar(heroe, unidad, glosario, hechizos);
  // De quien es cada regla, por si el heroe se separa o cae: sin matiz, la
  // tienen los dos; lo que el heroe presta a la unidad solo vale unidos.
  const propias = (unit: PerfilLibro) =>
    new Set([...unit.rules, ...unit.loadout.flatMap((entrada) => entrada.rules)].map((etiqueta) => etiqueta.trim().toLowerCase()));
  const delHeroe = propias(heroe);
  const deLaUnidad = propias(unidad);
  const prestadas = new Set(aportesDelPar(heroe, unidad, glosario).map((aporte) => aporte.concede.etiqueta.trim().toLowerCase()));
  const matizDe = (etiqueta: string) => {
    const clave = etiqueta.trim().toLowerCase();
    if (delHeroe.has(clave) && deLaUnidad.has(clave)) return null;
    if (delHeroe.has(clave)) return t.soloHeroe;
    if (deLaUnidad.has(clave)) return t.soloUnidad;
    return prestadas.has(clave) ? t.soloUnidos : null;
  };
  return (
    <View style={s.ficha} wrap={altoParEstimadoMm(heroe, unidad, glosario, hechizos) > ALTO_UTIL_MM}>
      <Cabecera
        s={s}
        t={t}
        nombre={`${heroe.name} + ${nombreConTamano(unidad)}`}
        combinada={Boolean(heroe.combined || unidad.combined)}
        atributos={[
          [t.miniaturas, String(heroe.size + unidad.size)],
          [t.puntos, String(heroe.cost + unidad.cost)],
        ]}
        miniatura={false}
        avatar={avatar}
      />
      <View style={s.cuerpo}>
        <View style={s.par}>
          <ColumnaPar s={s} t={t} unit={heroe} />
          <ColumnaPar s={s} t={t} unit={unidad} />
        </View>
        {reglas.length > 0 ? <BloqueReglas s={s} t={t} reglas={reglas} glosario={glosario} matizDe={matizDe} /> : null}
        {hechizos.length > 0 ? (
          <Bloque s={s} titulo={t.hechizos}>
            <TablaHechizos s={s} t={t} hechizos={hechizos} />
          </Bloque>
        ) : null}
      </View>
    </View>
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

function tipoConfiguracion(section: UpgradeSection, t: Textos): string {
  const limite = section.select?.value ? ` ${section.select.value}` : "";
  return `${section.variant ?? t.configuracion}${limite}`;
}

/** Una seccion de configuracion de la unidad, como ficha aparte y sangrada
 *  bajo la de su unidad. */
export function FichaOpcionesPdf({
  s,
  t,
  nombre,
  unitId,
  section,
  glosario,
}: {
  s: Estilos;
  t: Textos;
  nombre: string;
  unitId: string;
  section: UpgradeSection;
  glosario: Map<string, CatalogRule>;
}) {
  return (
    <View style={[s.ficha, s.fichaOpciones]} wrap={false}>
      <View style={[s.cabecera, { flexDirection: "column" }]}>
        <View style={s.nombre}>
          <Text>
            {nombre}
            <Text style={s.separador}> / </Text>
            {section.label ?? t.opciones}
          </Text>
        </View>
        <View style={s.meta}>
          <Text style={s.metaPastilla}>
            {t.tipo}: {tipoConfiguracion(section, t)}
          </Text>
          <Text style={s.metaPastilla}>
            {t.unidad}: {nombre}
          </Text>
        </View>
      </View>
      <View style={s.cuerpo}>
        <Tabla
          s={s}
          columnas={[
            { titulo: t.opcion, ancho: "26%" },
            { titulo: t.coste, ancho: "10%", num: true },
            { titulo: t.concede, ancho: "26%" },
            { titulo: t.reglas, ancho: "38%" },
          ]}
          filas={(section.options ?? []).map((option, indice) => {
            const coste = optionCost(option, unitId);
            return {
              key: option.id ?? option.uid ?? `${indice}`,
              celdas: [
                option.label ?? t.opcion,
                coste === 0 ? t.gratis : `+${coste}`,
                textoGanancia(option) ?? <Text style={s.vacio}>—</Text>,
                <ReglasTexto s={s} etiquetas={reglasDeOpcion(option)} glosario={glosario} />,
              ],
            };
          })}
        />
      </View>
    </View>
  );
}

/**
 * Descarga una imagen con la sesion —las del catalogo y los avatares estan en
 * Appwrite— y la reduce a lo que mide en papel: el original puede pasar de
 * 4000 px y unos megas, y en el PDF ocupa unos centimetros. El fondo es el
 * papel de la ficha, porque un PNG recortado pasado a JPEG se quedaria en
 * negro. Si no se puede, null: el PDF sale igual, sin esa imagen.
 */
export async function imagenParaPdf(url: string, ladoMaximo: number, fondo: string): Promise<string | null> {
  try {
    // Una portada externa puede no admitir credenciales: entonces, sin ellas.
    const respuesta = await fetch(url, { credentials: "include" }).catch(() => fetch(url));
    if (!respuesta.ok) return null;
    const mapa = await createImageBitmap(await respuesta.blob());
    const escala = Math.min(1, ladoMaximo / Math.max(mapa.width, mapa.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    const contexto = lienzo.getContext("2d");
    if (!contexto) return null;
    contexto.fillStyle = fondo;
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    contexto.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    mapa.close();
    return lienzo.toDataURL("image/jpeg", 0.85);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Las imagenes de una lista, una sola vez por URL aunque se repitan. */
export async function imagenesParaPdf(urls: Array<string | null | undefined>, ladoMaximo: number, fondo: string): Promise<Map<string, string>> {
  const unicas = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  const imagenes = await Promise.all(unicas.map((url) => imagenParaPdf(url, ladoMaximo, fondo)));
  return new Map(unicas.flatMap((url, indice) => (imagenes[indice] ? [[url, imagenes[indice]] as [string, string]] : [])));
}
