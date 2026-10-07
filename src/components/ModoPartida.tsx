import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import TextoConReferencias from "@rubenciveira/opr-kit/react/TextoConReferencias";
import type { HeroSkillCardData } from "@rubenciveira/opr-kit/react/HeroSkillCard";
import { useTextos } from "@rubenciveira/opr-kit/react/textos";
import { conValor, parseHabilidad } from "@rubenciveira/opr-kit/core/reglas";
import type { Habilidad } from "@rubenciveira/opr-kit/core/reglas";
import { agruparUnidades, separarFila } from "@rubenciveira/opr-kit/core/unidades";
import type { FilaEjercito } from "@rubenciveira/opr-kit/core/unidades";
import type { CatalogRule } from "../api/catalog";
import ConfirmDialog from "./ConfirmDialog";

/** A donde mandan sus chips las cartas de unidad: en modo partida, a la hoja inferior. */
export interface AbrirDesdeCarta {
  onHabilidad: (habilidad: Habilidad) => void;
  onQuestClassSkill: (skill: HeroSkillCardData) => void;
}

type Detalle = { tipo: "regla"; habilidad: Habilidad } | { tipo: "clase"; skill: HeroSkillCardData };

/** Los marcadores de una unidad durante la partida. */
interface EstadoUnidad {
  activada?: boolean;
  heridas?: number;
  desmoralizada?: boolean;
}

/**
 * Una partida en curso: la ronda, los marcadores de cada unidad por
 * `FilaEjercito.key` y los heroes que se han separado de su unidad.
 */
interface Partida {
  ronda: number;
  unidades: Record<string, EstadoUnidad>;
  /** Claves de las filas unidas que van por separado en esta partida. */
  separadas?: string[];
}

/** Pixeles por milimetro CSS: las cartas miden en mm y el hueco en px. */
const PX_POR_MM = 96 / 25.4;

/**
 * Sitio que deja la carta de unidad para las mejoras, que van debajo del marco
 * y no escalan con el.
 */
const RESERVA_MEJORAS = 48;

/**
 * Movil tumbado: la misma consulta que en la hoja de estilos. Ahi la carta se
 * ajusta al ancho y crece lo que pida su contenido, en vez de encogerse entera
 * para caber en un alto que no hay.
 */
const CONSULTA_TUMBADO = "(min-width: 641px) and (max-height: 500px)";

/** Ancho de cada naipe de la mano, en px: el mismo que en la hoja de estilos. */
const ANCHO_NAIPE = 110;

/**
 * Lo minimo que tiene que asomar cada naipe del abanico para leer su nombre y
 * acertar con el dedo. Si no llega, la mano pasa a una fila con desplazamiento.
 */
const ASOMA_MINIMO = 60;

/**
 * La partida en curso se guarda en este navegador, por ejercito: salir del
 * modo partida o recargar a media partida no deberia borrar los marcadores.
 * Solo los quita "Terminar partida".
 */
const clavePartida = (armyId: string) => `warhost:partida:${armyId}`;

function leerPartida(armyId: string): Partida | null {
  try {
    return JSON.parse(window.localStorage.getItem(clavePartida(armyId)) ?? "null") as Partida | null;
  } catch {
    return null;
  }
}

/**
 * El ejercito para jugar: toda la ventana para una carta en el centro, tan
 * grande como quepa, y abajo el resto de unidades para saltar a otra. Las
 * habilidades suben en una hoja inferior sin tapar del todo la carta. Con una
 * partida iniciada, cada unidad lleva sus marcadores (activada, heridas,
 * desmoralizada) y la barra lleva la ronda. La pantalla completa del navegador
 * va aparte, con su boton: no se impone al entrar.
 */
export default function ModoPartida({
  armyId,
  nombre,
  filas: filasUnidas,
  quest,
  glosario,
  cartaDe,
  onSalir,
}: {
  armyId: string;
  nombre: string;
  /** Las unidades con sus heroes unidos, como en la vista del ejercito. */
  filas: FilaEjercito[];
  quest: boolean;
  glosario: Map<string, CatalogRule>;
  cartaDe: (fila: FilaEjercito, abrir: AbrirDesdeCarta) => ReactNode;
  onSalir: () => void;
}) {
  const t = useTextos();
  const [partida, setPartida] = useState<Partida | null>(() => leerPartida(armyId));
  // Un heroe separado y su unidad van como dos naipes, cada uno en su grupo y
  // con sus marcadores. Cada mitad apunta a la fila unida para volver a juntarse.
  const separadas = new Set(partida?.separadas ?? []);
  const unidaDe = new Map<string, FilaEjercito>();
  const filas = agruparUnidades(
    filasUnidas.flatMap((fila) => {
      if (!fila.adjunta || !separadas.has(fila.key)) return [fila];
      const mitades = separarFila(fila);
      for (const mitad of mitades) unidaDe.set(mitad.key, fila);
      return mitades;
    }),
  ).flatMap((seccion) => seccion.unidades);
  const [claveActual, setClaveActual] = useState(filas[0]?.key ?? "");
  const [completa, setCompleta] = useState(Boolean(document.fullscreenElement));
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [confirmandoFin, setConfirmandoFin] = useState(false);
  const [hueco, setHueco] = useState({ ancho: 0, alto: 0 });
  /** El de la mano, que no siempre es el de la carta: con partida, los marcadores le quitan ancho a esta. */
  const [anchoMano, setAnchoMano] = useState(0);
  const escenaRef = useRef<HTMLDivElement>(null);
  const manoRef = useRef<HTMLElement>(null);

  // Si la unidad elegida desaparece de la lista, se cae a la primera.
  const indiceActual = Math.max(0, filas.findIndex((fila) => fila.key === claveActual));
  const actual = filas[indiceActual];

  useEffect(() => {
    try {
      if (partida) window.localStorage.setItem(clavePartida(armyId), JSON.stringify(partida));
      else window.localStorage.removeItem(clavePartida(armyId));
    } catch {
      // Sin almacenamiento (navegacion privada) la partida sigue, solo que no
      // sobrevive a una recarga.
    }
  }, [armyId, partida]);

  // La pantalla completa la puede quitar el propio navegador (Escape, gesto):
  // el boton sigue a lo que haya de verdad, no a lo ultimo que se pidio.
  useEffect(() => {
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alCambiar = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", alCambiar);
    return () => {
      document.removeEventListener("fullscreenchange", alCambiar);
      document.body.style.overflow = desbordeAnterior;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const escena = escenaRef.current;
    const mano = manoRef.current;
    if (!escena || !mano) return undefined;
    const observador = new ResizeObserver((entradas) => {
      for (const { target, contentRect } of entradas) {
        if (target === escena) setHueco({ ancho: contentRect.width, alto: contentRect.height });
        else setAnchoMano(contentRect.width);
      }
    });
    observador.observe(escena);
    observador.observe(mano);
    return () => observador.disconnect();
  }, []);

  function elegir(indice: number) {
    const fila = filas[(indice + filas.length) % filas.length];
    if (!fila) return;
    setClaveActual(fila.key);
    setDetalle(null);
  }

  function alternarPantallaCompleta() {
    const peticion = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    peticion.catch(() => undefined);
  }

  const estadoDe = (fila: FilaEjercito): EstadoUnidad => partida?.unidades[fila.key] ?? {};

  function marcar(fila: FilaEjercito, cambio: EstadoUnidad) {
    setPartida((previa) =>
      previa && { ...previa, unidades: { ...previa.unidades, [fila.key]: { ...previa.unidades[fila.key], ...cambio } } },
    );
  }

  /**
   * Las heridas las encaja la unidad antes que el heroe: al separarse, ella se
   * queda con las que aguante y el resto pasa al heroe. Activacion y
   * desmoralizacion las comparten.
   */
  function separar(fila: FilaEjercito) {
    const [heroe, unidad] = separarFila(fila);
    if (!heroe || !unidad) return;
    const estado = estadoDe(fila);
    const heridas = estado.heridas ?? 0;
    const heridasUnidad = Math.min(heridas, unidad.principal.maxWounds);
    setPartida(
      (previa) =>
        previa && {
          ...previa,
          separadas: [...(previa.separadas ?? []), fila.key],
          unidades: {
            ...previa.unidades,
            [heroe.key]: { ...estado, heridas: heridas - heridasUnidad },
            [unidad.key]: { ...estado, heridas: heridasUnidad },
          },
        },
    );
  }

  /** Al volver a unirse se suman las heridas; activada o desmoralizada si lo estaba cualquiera. */
  function unir(fila: FilaEjercito) {
    const [heroe, unidad] = separarFila(fila);
    if (!heroe || !unidad) return;
    const deHeroe = estadoDe(heroe);
    const deUnidad = estadoDe(unidad);
    setPartida((previa) => {
      if (!previa) return previa;
      const unidades = { ...previa.unidades };
      delete unidades[unidad.key];
      unidades[fila.key] = {
        activada: Boolean(deHeroe.activada || deUnidad.activada),
        heridas: (deHeroe.heridas ?? 0) + (deUnidad.heridas ?? 0),
        desmoralizada: Boolean(deHeroe.desmoralizada || deUnidad.desmoralizada),
      };
      return { ...previa, separadas: previa.separadas?.filter((clave) => clave !== fila.key), unidades };
    });
    setClaveActual(fila.key);
  }

  /** La ronda nueva quita las activaciones; heridas y desmoralizacion siguen. */
  function nuevaRonda() {
    setPartida(
      (previa) =>
        previa && {
          ...previa,
          ronda: previa.ronda + 1,
          unidades: Object.fromEntries(
            Object.entries(previa.unidades).map(([clave, estado]) => [clave, { ...estado, activada: false }]),
          ),
        },
    );
  }

  // Con teclado: flechas para pasar de unidad, Escape para cerrar la hoja. Con
  // el dialogo de terminar abierto, el Escape es suyo.
  useEffect(() => {
    const conTecla = (event: KeyboardEvent) => {
      if (confirmandoFin) return;
      if (event.key === "Escape") setDetalle(null);
      else if (event.key === "ArrowRight") elegir(indiceActual + 1);
      else if (event.key === "ArrowLeft") elegir(indiceActual - 1);
    };
    document.addEventListener("keydown", conTecla);
    return () => document.removeEventListener("keydown", conTecla);
  });

  // La carta se escala entera para llenar el hueco, como hace el resto de la
  // app con `--ucard-esc` segun el ancho de pantalla. El hueco cambia de tamano
  // al girar la pantalla, y con el se vuelve a pintar y a consultar.
  const conMejoras = Boolean(actual?.principal.upgrades?.length || actual?.adjunta?.upgrades?.length);
  const reserva = conMejoras ? RESERVA_MEJORAS : 0;
  const porAncho = hueco.ancho / (120 * PX_POR_MM);
  const escala = Math.max(
    0.3,
    window.matchMedia(CONSULTA_TUMBADO).matches
      ? porAncho
      : Math.min(porAncho, (hueco.alto - reserva) / ((quest ? 140 : 70) * PX_POR_MM)),
  );
  // La mano de naipes se abre en abanico hasta donde deja el ancho, con un
  // naipe y medio de margen a cada lado para lo que se desplazan al girar: con
  // muchas unidades se solapan mas y se inclinan menos. Si ya no asoma lo
  // bastante de cada uno, van en fila y se desliza.
  const huecosMano = Math.max(1, filas.length - 1);
  const pasoAbanico = (anchoMano - 3 * ANCHO_NAIPE) / huecosMano;
  const enAbanico = pasoAbanico >= ASOMA_MINIMO;
  const pasoNaipe = Math.min(70, pasoAbanico);
  const giroNaipe = Math.min(4, 30 / huecosMano);
  // En la fila, la unidad elegida se centra sola: con el teclado o al tocar una
  // del borde, no hay que ir a buscarla.
  useEffect(() => {
    const mano = manoRef.current;
    const activa = mano?.querySelector<HTMLElement>(".activa");
    if (enAbanico || !mano || !activa) return;
    mano.scrollTo({ left: activa.offsetLeft - (mano.clientWidth - activa.offsetWidth) / 2, behavior: "smooth" });
  }, [enAbanico, indiceActual]);

  const abrir: AbrirDesdeCarta = {
    onHabilidad: (habilidad) => setDetalle({ tipo: "regla", habilidad }),
    onQuestClassSkill: (skill) => setDetalle({ tipo: "clase", skill }),
  };
  const activadas = filas.filter((fila) => estadoDe(fila).activada).length;
  const estadoActual = actual ? estadoDe(actual) : {};
  // Con un heroe unido el aguante es de dos perfiles distintos: no hay un tope unico.
  const heridasMax = actual && !actual.adjunta ? actual.principal.maxWounds : undefined;
  const unidaActual = actual && unidaDe.get(actual.key);

  return (
    <div className="partida" role="dialog" aria-modal="true" aria-label={`Modo partida: ${nombre}`}>
      <header className="partida-barra">
        <h1 className="partida-titulo">{nombre}</h1>
        {/* En pantalla ancha la ronda va en la barra; en un movil de pie, en
            su propio renglon debajo. */}
        {partida ? (
          <div className="partida-ronda">
            <span className="partida-ronda-texto">
              <strong>Ronda {partida.ronda}</strong> · {activadas}/{filas.length}
                <span className="partida-ronda-extra"> activadas</span>
            </span>
            <button type="button" onClick={nuevaRonda}>
              Nueva ronda
            </button>
            <button type="button" className="danger" onClick={() => setConfirmandoFin(true)}>
              Terminar
            </button>
            <span className="partida-progreso" aria-hidden="true">
              <span style={{ width: `${filas.length ? (activadas / filas.length) * 100 : 0}%` }} />
            </span>
          </div>
        ) : null}
        {document.fullscreenEnabled ? (
          <button
            type="button"
            className="ghost"
            aria-pressed={completa}
            aria-label="Pantalla completa"
            title={completa ? "Salir de pantalla completa" : "Pantalla completa"}
            onClick={alternarPantallaCompleta}
          >
            ⛶
          </button>
        ) : null}
        {partida ? null : (
          <button type="button" onClick={() => setPartida({ ronda: 1, unidades: {} })}>
            Iniciar partida
          </button>
        )}
        <button type="button" className="primary" title="Salir del modo partida" onClick={onSalir}>
          Salir
        </button>
      </header>


      {/* Los marcadores van debajo de la carta en un movil de pie y a su
          derecha con ancho de sobra, donde a la carta le falta alto. */}
      <div className="partida-centro">
        {/* `vertical-movil`: en un movil de pie la carta de unidad se recoloca a
            lo ancho, como en la vista del ejercito, en vez de quedarse en un
            naipe apaisado diminuto. */}
        <div
          ref={escenaRef}
          className="partida-escena vertical-movil"
          style={{ "--ucard-esc": escala } as CSSProperties}
        >
          <div className={`partida-carta${estadoActual.activada ? " activada" : ""}`}>
            {actual ? cartaDe(actual, abrir) : null}
          </div>
        </div>

        {partida && actual ? (
          <div className="partida-marcadores" aria-label={`Marcadores de ${nombreDe(actual)}`}>
            <button
              type="button"
              aria-pressed={Boolean(estadoActual.activada)}
              className={estadoActual.activada ? "marcado" : undefined}
              onClick={() => marcar(actual, { activada: !estadoActual.activada })}
            >
              {estadoActual.activada ? "✓ Activada" : "Activar"}
            </button>
            <span className="partida-heridas-control">
              <button
                type="button"
                aria-label="Quitar herida"
                disabled={!estadoActual.heridas}
                onClick={() => marcar(actual, { heridas: Math.max(0, (estadoActual.heridas ?? 0) - 1) })}
              >
                −
              </button>
              <span>
                Heridas <strong>{estadoActual.heridas ?? 0}</strong>
                {heridasMax !== undefined ? `/${heridasMax}` : ""}
              </span>
              <button
                type="button"
                aria-label="Anadir herida"
                disabled={heridasMax !== undefined && (estadoActual.heridas ?? 0) >= heridasMax}
                onClick={() => marcar(actual, { heridas: (estadoActual.heridas ?? 0) + 1 })}
              >
                +
              </button>
            </span>
            <button
              type="button"
              aria-pressed={Boolean(estadoActual.desmoralizada)}
              className={estadoActual.desmoralizada ? "marcado peligro" : undefined}
              onClick={() => marcar(actual, { desmoralizada: !estadoActual.desmoralizada })}
            >
              Desmoralizada
            </button>
            {actual.adjunta ? (
              <button type="button" title="El heroe y su unidad siguen por separado" onClick={() => separar(actual)}>
                Separar
              </button>
            ) : null}
            {unidaActual ? (
              <button
                type="button"
                title={`Vuelve a unir ${nombreDe(unidaActual)}`}
                onClick={() => unir(unidaActual)}
              >
                Volver a unir
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* El resto de unidades asoman abajo como una mano de naipes: en abanico
          si caben, y si no en fila con desplazamiento lateral. */}
      <nav ref={manoRef} className={`partida-mano${enAbanico ? "" : " desplazable"}`} aria-label="Unidades">
        {filas.map((fila, indice) => {
          const desvio = indice - (filas.length - 1) / 2;
          const estado = estadoDe(fila);
          return (
            <button
              key={fila.key}
              type="button"
              className={[
                "partida-naipe",
                fila === actual ? "activa" : "",
                estado.activada ? "activada" : "",
                estado.desmoralizada ? "desmoralizada" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={fila === actual ? "true" : undefined}
              title={[nombreDe(fila), ...marcasDe(estado)].join(" · ")}
              style={
                enAbanico
                  ? {
                      left: `calc(50% - ${ANCHO_NAIPE / 2}px + ${desvio * pasoNaipe}px)`,
                      transform: `rotate(${desvio * giroNaipe}deg)`,
                    }
                  : undefined
              }
              onClick={() => elegir(indice)}
            >
              <span>
                {/* A la izquierda del nombre: es lo que asoma, el naipe de la
                    derecha tapa la otra mitad. */}
                {estado.heridas ? <em className="partida-naipe-heridas">{estado.heridas}</em> : null}
                {nombreDe(fila)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* La habilidad sube en una hoja desde abajo: la carta sigue detras, y
          tocar fuera la cierra. */}
      {detalle ? (
        <div className="partida-hoja-fondo" onClick={() => setDetalle(null)}>
          <section
            className="partida-hoja"
            role="dialog"
            aria-label={detalle.tipo === "regla" ? detalle.habilidad.nombre : detalle.skill.name}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="partida-hoja-asa" aria-hidden="true" />
            <header className="partida-hoja-cabecera">
              <h2>
                {detalle.tipo === "regla" ? detalle.habilidad.nombre : detalle.skill.name}
                {detalle.tipo === "regla" && detalle.habilidad.valor ? (
                  <span className="partida-hoja-valor"> ({detalle.habilidad.valor})</span>
                ) : null}
              </h2>
              <button type="button" className="ghost" aria-label="Cerrar" onClick={() => setDetalle(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </header>
            <div className="partida-hoja-cuerpo">
              {detalle.tipo === "regla" ? (
                <TextoRegla habilidad={detalle.habilidad} glosario={glosario} onAbrir={abrir.onHabilidad} />
              ) : (
                <>
                  <p className="partida-hoja-sub">
                    {detalle.skill.className} · {detalle.skill.levelLabel}
                  </p>
                  <p>
                    <TextoConReferencias texto={detalle.skill.description} glosario={glosario} onAbrir={abrir.onHabilidad} />
                  </p>
                </>
              )}
              <p className="partida-hoja-sub">
                {detalle.tipo === "regla" && detalle.habilidad.tipo === "equipo" ? t.equipo : t.reglaEspecial}
              </p>
            </div>
          </section>
        </div>
      ) : null}

      {confirmandoFin ? (
        <ConfirmDialog
          title="Terminar la partida"
          confirmLabel="Terminar"
          danger
          onCancel={() => setConfirmandoFin(false)}
          onConfirm={() => {
            setConfirmandoFin(false);
            setPartida(null);
          }}
        >
          <p>Se quitan la ronda y los marcadores de todas las unidades.</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** El texto de una regla para la hoja: el mismo que su carta, en prosa a lo ancho. */
function TextoRegla({
  habilidad,
  glosario,
  onAbrir,
}: {
  habilidad: Habilidad;
  glosario: Map<string, CatalogRule>;
  onAbrir: (habilidad: Habilidad) => void;
}) {
  const t = useTextos();
  const regla = glosario.get(habilidad.nombre.toLowerCase());
  const texto = regla ? conValor(regla.description, habilidad.valor) : null;
  const concede = habilidad.concede?.map((nombre) => parseHabilidad(nombre, "regla")) ?? [];
  return (
    <>
      {texto ? (
        <p>
          <TextoConReferencias texto={texto} glosario={glosario} onAbrir={onAbrir} propio={habilidad.nombre} />
        </p>
      ) : concede.length === 0 ? (
        <p className="muted">{t.sinTexto}</p>
      ) : null}
      {concede.length > 0 ? (
        <p>
          {t.concede}{" "}
          {concede.map((una, indice) => (
            <span key={una.nombre}>
              {indice > 0 ? ", " : ""}
              <button type="button" className="regla-mencion" onClick={() => onAbrir(una)}>
                {una.etiqueta}
              </button>
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}

function nombreDe(fila: FilaEjercito): string {
  return fila.adjunta ? `${fila.principal.name} + ${fila.adjunta.name}` : fila.principal.name;
}

/** Los marcadores de una unidad en palabras, para el aviso de su naipe. */
function marcasDe(estado: EstadoUnidad): string[] {
  return [
    estado.activada ? "Activada" : "",
    estado.heridas ? `${estado.heridas} ${estado.heridas === 1 ? "herida" : "heridas"}` : "",
    estado.desmoralizada ? "Desmoralizada" : "",
  ].filter(Boolean);
}
