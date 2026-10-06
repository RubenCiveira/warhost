"use client";

import { useEffect, useRef, useState } from "react";
import type { ArmyBook, CatalogRule } from "../core/model";
import type { ResolvedUnit } from "../core/armyForgeResolve";
import type { ArmyNoun } from "../core/gameSystems";
import { abrirPdf, guardarPdf } from "./pdfImpresion";
import { useTextos } from "./textos";

/**
 * El PDF de un ejercito, sobre su propia pagina: se genera nada mas abrir, en
 * el modo elegido en el menu, y al acabar pregunta si abrirlo o guardarlo. Se
 * dibuja como texto en pdfEjercito, que se carga solo al pedirlo.
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
  modo,
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
  /** Libro: fichas con el texto completo. Tarjetas: cartas con su dorso. */
  modo: "libro" | "tarjetas";
  onCerrar: () => void;
}) {
  const t = useTextos();
  const [generando, setGenerando] = useState(true);
  const [errorPdf, setErrorPdf] = useState(false);
  /** El PDF ya generado, a la espera de que se elija abrirlo o guardarlo. */
  const [pdfListo, setPdfListo] = useState<{ pdf: Blob; archivo: string } | null>(null);
  const primeraAccionRef = useRef<HTMLButtonElement>(null);
  // El estado no se actualiza a tiempo para frenar un segundo clic, ni el
  // doble montaje de StrictMode: una ref si.
  const enCurso = useRef(false);

  const generarPdf = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setErrorPdf(false);
    setGenerando(true);
    try {
      const { generarPdfEjercito } = await import("./pdfEjercito");
      const pdf = await generarPdfEjercito({
        modo,
        nombre,
        noun,
        quest,
        units,
        entradasAttachedTo,
        glosario,
        librosConocidos,
        avatarDe,
        puedeLanzarHechizos,
        t,
        ambientacion: document.documentElement.dataset.setting === "fantasy" ? "fantasy" : "grimdark",
      });
      setPdfListo({ pdf, archivo: `${nombre || noun.singular} - ${modo === "libro" ? t.modoLibro : t.modoTarjetas}.pdf` });
    } catch (error) {
      console.error(error);
      setErrorPdf(true);
    } finally {
      enCurso.current = false;
      setGenerando(false);
    }
  };

  useEffect(() => {
    void generarPdf();
    // Solo al abrir: si falla, se reintenta con el boton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abrir, guardar o cerrar terminan con el PDF y se vuelve al ejercito.
  const abrir = () => {
    if (!pdfListo) return;
    abrirPdf(pdfListo.pdf, pdfListo.archivo);
    onCerrar();
  };
  const guardar = async () => {
    if (pdfListo && (await guardarPdf(pdfListo.pdf, pdfListo.archivo))) onCerrar();
  };

  useEffect(() => {
    if (generando) return undefined;
    primeraAccionRef.current?.focus();
    const conEscape = (event: KeyboardEvent) => event.key === "Escape" && onCerrar();
    document.addEventListener("keydown", conEscape);
    return () => document.removeEventListener("keydown", conEscape);
  }, [generando, pdfListo]);

  return (
    <div className="print-pdf-capa" role={generando ? "status" : undefined} aria-live={generando ? "polite" : undefined}>
      {generando ? (
        <div className="print-pdf-espera">
          <span className="print-pdf-spinner" aria-hidden="true" />
          <span>{t.preparandoPdf}</span>
        </div>
      ) : pdfListo ? (
        <div className="print-pdf-espera print-pdf-dialogo" role="dialog" aria-modal="true" aria-labelledby="print-pdf-listo">
          <p id="print-pdf-listo" className="print-pdf-titulo">{t.pdfListo}</p>
          <p className="print-pdf-archivo">{pdfListo.archivo}</p>
          {/* Recortar las cartas y casar sus dorsos pide el tamano exacto. */}
          {modo === "tarjetas" ? <p className="print-pdf-archivo">{t.pdfTamanoReal}</p> : null}
          <div className="print-pdf-acciones">
            <button type="button" className="ghost" onClick={onCerrar}>
              {t.cerrar}
            </button>
            <button type="button" onClick={() => void guardar()}>
              {t.guardarPdf}
            </button>
            <button type="button" className="primary" ref={primeraAccionRef} onClick={abrir}>
              {t.abrirPdf}
            </button>
          </div>
        </div>
      ) : (
        <div className="print-pdf-espera print-pdf-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="print-pdf-error">
          <p id="print-pdf-error" className="print-pdf-error">
            {errorPdf ? t.errorPdf : null}
          </p>
          <div className="print-pdf-acciones">
            <button type="button" className="ghost" onClick={onCerrar}>
              {t.cerrar}
            </button>
            <button type="button" className="primary" ref={primeraAccionRef} onClick={() => void generarPdf()}>
              {t.crearPdf}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
