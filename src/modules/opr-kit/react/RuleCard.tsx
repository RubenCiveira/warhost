"use client";

import type { CatalogRule } from "../core/model";
import { conValor, parseHabilidad } from "../core/reglas";
import type { Habilidad } from "../core/reglas";
import { densidadScard } from "./cardDensity";
import TextoConReferencias from "./TextoConReferencias";
import { useTextos } from "./textos";

/**
 * Habilidad o equipo en carta Mini Euro vertical, la misma que el hechizo.
 *
 * Una regla sin descripcion sigue teniendo carta: dice que es del reglamento
 * basico, que es informacion util, en vez de fingir que no existe.
 */
export default function RuleCard({
  habilidad,
  regla,
  lleva,
  glosario,
  onAbrir,
}: {
  habilidad: Habilidad;
  regla?: CatalogRule | null;
  /** Unidades que lo llevan de serie, en la vista de equipo de la faccion. */
  lleva?: string[];
  /** Con esto, las menciones a otras reglas en el texto se abren como referencia cruzada. */
  glosario?: Map<string, CatalogRule>;
  onAbrir?: (habilidad: Habilidad) => void;
}) {
  const t = useTextos();
  const texto = regla ? conValor(regla.description, habilidad.valor) : null;
  const concede = habilidad.concede?.length ? habilidad.concede.map((nombre) => parseHabilidad(nombre, "regla")) : null;
  const listaConcede = concede ? (
    <>
      {t.concede}{" "}
      {concede.map((una, indice) => (
        <span key={una.nombre}>
          {indice > 0 ? ", " : ""}
          {onAbrir ? (
            <button type="button" className="regla-mencion" onClick={() => onAbrir(una)}>
              {una.etiqueta}
            </button>
          ) : (
            una.etiqueta
          )}
        </span>
      ))}
    </>
  ) : null;

  return (
    <div className="scard-frame">
      <article className={`scard${densidadScard(texto, habilidad.concede?.length ? `${t.concede} ${habilidad.concede.join(", ")}` : null)}`}>
        <header className="scard-head">
          <h3 className="scard-title">{habilidad.nombre}</h3>
          {habilidad.valor ? (
            <div className="scard-valor">
              <span className="scard-valor-key">{t.valor}</span>
              <span className="scard-valor-num">{habilidad.valor}</span>
            </div>
          ) : null}
        </header>

        <div className="scard-body">
          {texto ? (
            <div>
              <p className="scard-efecto">
                <TextoConReferencias texto={texto} glosario={glosario} onAbrir={onAbrir} propio={habilidad.nombre} />
              </p>
              {listaConcede ? <p className="scard-concede">{listaConcede}</p> : null}
            </div>
          ) : listaConcede ? (
            <div>
              <p className="scard-efecto">{listaConcede}.</p>
            </div>
          ) : (
            <p className="scard-efecto scard-sin-texto">{t.sinTexto}</p>
          )}
        </div>

        <footer className="scard-foot">
          <span className="scard-faccion">{habilidad.tipo === "equipo" ? t.equipo : t.reglaEspecial}</span>
          {lleva?.length ? (
            <span className="scard-tirada">{t.loLlevan(lleva)}</span>
          ) : null}
        </footer>
      </article>
    </div>
  );
}
