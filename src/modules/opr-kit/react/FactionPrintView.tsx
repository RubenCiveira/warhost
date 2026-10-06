"use client";

import { useEffect, useRef, useState } from "react";
import type { ArmyBook, ArmyUnit, CatalogRule } from "../core/model";
import type { UpgradeSection } from "../core/builder";
import { abrirPdf, guardarPdf } from "./pdfImpresion";
import { useTextos } from "./textos";

/**
 * El PDF de una faccion, sobre su propia pagina: un dialogo para elegir que
 * lleva, la espera mientras se genera y, al acabar, abrirlo o guardarlo. El
 * PDF se dibuja como texto en pdfFaccion, que se carga solo al pulsar.
 */
export default function FactionPrintView({
  book,
  units,
  coverUrl,
  miniaturaDe,
  packages,
  glosario,
  onCerrar,
}: {
  book: ArmyBook;
  units: ArmyUnit[];
  /** Imagen de la portada; sin ella, la portada sale solo con el nombre. */
  coverUrl?: string | null;
  miniaturaDe?: (unit: ArmyUnit) => string | null;
  packages: Map<string, UpgradeSection[]>;
  glosario: Map<string, CatalogRule>;
  onCerrar: () => void;
}) {
  const t = useTextos();
  const [portada, setPortada] = useState(true);
  const [incluirLore, setIncluirLore] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [errorPdf, setErrorPdf] = useState(false);
  /** El PDF ya generado, a la espera de que se elija abrirlo o guardarlo. */
  const [pdfListo, setPdfListo] = useState<{ pdf: Blob; archivo: string } | null>(null);
  const primeraAccionRef = useRef<HTMLButtonElement>(null);
  // El estado no se actualiza a tiempo para frenar un segundo clic: una ref si.
  const enCurso = useRef(false);

  const generarPdf = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setErrorPdf(false);
    setGenerando(true);
    try {
      const { generarPdfFaccion } = await import("./pdfFaccion");
      const pdf = await generarPdfFaccion({
        book,
        units,
        packages,
        glosario,
        t,
        coverUrl: coverUrl ?? null,
        miniaturaDe,
        portada,
        incluirLore,
        ambientacion: document.documentElement.dataset.setting === "fantasy" ? "fantasy" : "grimdark",
      });
      setPdfListo({ pdf, archivo: `${book.name}.pdf` });
    } catch (error) {
      console.error(error);
      setErrorPdf(true);
    } finally {
      enCurso.current = false;
      setGenerando(false);
    }
  };

  // Abrir, guardar o cerrar terminan con el PDF y se vuelve a la faccion.
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
        <div className="print-pdf-espera print-pdf-dialogo" role="dialog" aria-modal="true" aria-labelledby="print-pdf-opciones">
          <p id="print-pdf-opciones" className="print-pdf-titulo">{t.convertirPdf}</p>
          <p className="print-pdf-archivo">{book.name}</p>
          <div className="print-lore-opciones">
            <label className="row" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={portada} onChange={(e) => setPortada(e.target.checked)} style={{ width: "auto" }} />
              <span>{t.portadaConImagen}</span>
            </label>
            {book.lore ? (
              <label className="row" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={incluirLore} onChange={(e) => setIncluirLore(e.target.checked)} style={{ width: "auto" }} />
                <span>{t.incluirTrasfondo}</span>
              </label>
            ) : null}
          </div>
          {errorPdf ? (
            <p className="print-pdf-error" role="alert">
              {t.errorPdf}
            </p>
          ) : null}
          <div className="print-pdf-acciones">
            <button type="button" className="ghost" onClick={onCerrar}>
              {t.cancelar}
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
