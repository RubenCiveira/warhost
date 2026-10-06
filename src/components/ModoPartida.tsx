import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import RuleCard from "@rubenciveira/opr-kit/react/RuleCard";
import HeroSkillCard from "@rubenciveira/opr-kit/react/HeroSkillCard";
import type { HeroSkillCardData } from "@rubenciveira/opr-kit/react/HeroSkillCard";
import type { Habilidad } from "@rubenciveira/opr-kit/core/reglas";
import type { FilaEjercito, GrupoDeUnidades } from "@rubenciveira/opr-kit/core/unidades";
import type { CatalogRule } from "../api/catalog";

/** A donde mandan sus chips las cartas de unidad: en modo partida, al centro. */
export interface AbrirDesdeCarta {
  onHabilidad: (habilidad: Habilidad) => void;
  onQuestClassSkill: (skill: HeroSkillCardData) => void;
}

type Detalle = { tipo: "regla"; habilidad: Habilidad } | { tipo: "clase"; skill: HeroSkillCardData };

/** Pixeles por milimetro CSS: las cartas miden en mm y el hueco en px. */
const PX_POR_MM = 96 / 25.4;

/**
 * Sitio que deja la carta de unidad para las mejoras, que van debajo del marco
 * y no escalan con el.
 */
const RESERVA_MEJORAS = 48;

/**
 * El ejercito para jugar: toda la ventana para una carta en el centro, tan
 * grande como quepa, y abajo el mazo plegado con la unidad actual, que se
 * despliega para saltar a otra. La pantalla completa del navegador va aparte,
 * con su boton: no se impone al entrar. Las habilidades de una carta se abren en ese mismo centro, no en
 * un modal encima, y se vuelve a la unidad desde la barra.
 */
export default function ModoPartida({
  nombre,
  secciones,
  quest,
  glosario,
  cartaDe,
  onSalir,
}: {
  nombre: string;
  /** Las unidades agrupadas como en la vista del ejercito, que es el orden del mazo. */
  secciones: GrupoDeUnidades<FilaEjercito>[];
  quest: boolean;
  glosario: Map<string, CatalogRule>;
  cartaDe: (fila: FilaEjercito, abrir: AbrirDesdeCarta) => ReactNode;
  onSalir: () => void;
}) {
  const filas = secciones.flatMap((seccion) => seccion.unidades);
  const [claveActual, setClaveActual] = useState(filas[0]?.key ?? "");
  const [mazoAbierto, setMazoAbierto] = useState(false);
  const [completa, setCompleta] = useState(Boolean(document.fullscreenElement));
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [hueco, setHueco] = useState({ ancho: 0, alto: 0 });
  const escenaRef = useRef<HTMLDivElement>(null);
  const mazoRef = useRef<HTMLDivElement>(null);

  // Si la unidad elegida desaparece de la lista, se cae a la primera.
  const indiceActual = Math.max(0, filas.findIndex((fila) => fila.key === claveActual));
  const actual = filas[indiceActual];

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
    if (!escena) return undefined;
    const observador = new ResizeObserver(([entrada]) =>
      setHueco({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height }),
    );
    observador.observe(escena);
    return () => observador.disconnect();
  }, []);

  function elegir(indice: number) {
    const fila = filas[(indice + filas.length) % filas.length];
    if (!fila) return;
    setClaveActual(fila.key);
    setDetalle(null);
    setMazoAbierto(false);
  }

  function alternarPantallaCompleta() {
    const peticion = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    peticion.catch(() => undefined);
  }

  // Con teclado: flechas para pasar de unidad, Escape para plegar el mazo o
  // volver de una habilidad.
  useEffect(() => {
    const conTecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mazoAbierto) setMazoAbierto(false);
        else setDetalle(null);
      }
      else if (event.key === "ArrowRight") elegir(indiceActual + 1);
      else if (event.key === "ArrowLeft") elegir(indiceActual - 1);
    };
    document.addEventListener("keydown", conTecla);
    return () => document.removeEventListener("keydown", conTecla);
  });

  // Al desplegar el mazo, la unidad actual a la vista aunque la lista sea larga.
  useEffect(() => {
    if (mazoAbierto) mazoRef.current?.querySelector(".activa")?.scrollIntoView({ block: "nearest" });
  }, [mazoAbierto]);

  // La carta se escala entera para llenar el hueco, como hace el resto de la
  // app con `--ucard-esc` y `--scard-esc` segun el ancho de pantalla.
  const [anchoMm, altoMm, variable] = detalle
    ? [44, 68, "--scard-esc"]
    : [120, quest ? 140 : 70, "--ucard-esc"];
  const conMejoras = Boolean(actual?.principal.upgrades?.length || actual?.adjunta?.upgrades?.length);
  const reserva = !detalle && conMejoras ? RESERVA_MEJORAS : 0;
  const escala = Math.max(
    0.3,
    Math.min(hueco.ancho / (anchoMm * PX_POR_MM), (hueco.alto - reserva) / (altoMm * PX_POR_MM)),
  );
  const abrir: AbrirDesdeCarta = {
    onHabilidad: (habilidad) => setDetalle({ tipo: "regla", habilidad }),
    onQuestClassSkill: (skill) => setDetalle({ tipo: "clase", skill }),
  };

  return (
    <div className="partida" role="dialog" aria-modal="true" aria-label={`Modo partida: ${nombre}`}>
      <header className="partida-barra">
        {detalle && actual ? (
          <button type="button" className="partida-volver" onClick={() => setDetalle(null)}>
            ← {actual.principal.name}
          </button>
        ) : null}
        <h1 className="partida-titulo">{nombre}</h1>
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
        <button type="button" className="primary" onClick={onSalir}>
          Salir del modo partida
        </button>
      </header>

      {/* `vertical-movil`: en un movil de pie la carta de unidad se recoloca a
          lo ancho, como en la vista del ejercito, en vez de quedarse en un
          naipe apaisado diminuto. */}
      <div
        ref={escenaRef}
        className={`partida-escena${detalle ? "" : " vertical-movil"}`}
        onClick={() => setMazoAbierto(false)}
        style={{ [variable]: escala } as CSSProperties}
      >
        <div className="partida-carta">
          {detalle?.tipo === "regla" ? (
            <RuleCard
              habilidad={detalle.habilidad}
              regla={glosario.get(detalle.habilidad.nombre.toLowerCase())}
              glosario={glosario}
              onAbrir={abrir.onHabilidad}
            />
          ) : detalle?.tipo === "clase" ? (
            <HeroSkillCard skill={detalle.skill} glosario={glosario} onAbrir={abrir.onHabilidad} />
          ) : actual ? (
            cartaDe(actual, abrir)
          ) : null}
        </div>
      </div>

      {/* Acordeon: plegado solo dice que unidad se esta viendo; desplegado
          sube por encima de la carta, sin empujarla ni cambiar su escala. */}
      <nav className="partida-mazo" aria-label="Unidades">
        {mazoAbierto ? (
          <div ref={mazoRef} id="partida-mazo-lista" className="partida-mazo-lista">
            {secciones.map((seccion) => (
              <section key={seccion.grupo}>
                <h2 className="partida-mazo-grupo">
                  {seccion.etiqueta}
                  <span className="tab-count">{seccion.unidades.length}</span>
                </h2>
                {seccion.unidades.map((fila) => (
                  <button
                    key={fila.key}
                    type="button"
                    className={fila === actual ? "activa" : undefined}
                    aria-current={fila === actual ? "true" : undefined}
                    onClick={() => elegir(filas.indexOf(fila))}
                  >
                    {nombreDe(fila)}
                  </button>
                ))}
              </section>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="partida-mazo-cabecera"
          aria-expanded={mazoAbierto}
          aria-controls="partida-mazo-lista"
          onClick={() => setMazoAbierto((abierto) => !abierto)}
        >
          <span className="partida-mazo-actual">{actual ? nombreDe(actual) : "Sin unidades"}</span>
          <span className="tab-count">
            {indiceActual + 1}/{filas.length}
          </span>
          <span aria-hidden="true">{mazoAbierto ? "▾" : "▴"}</span>
        </button>
      </nav>
    </div>
  );
}

function nombreDe(fila: FilaEjercito): string {
  return fila.adjunta ? `${fila.principal.name} + ${fila.adjunta.name}` : fila.principal.name;
}
