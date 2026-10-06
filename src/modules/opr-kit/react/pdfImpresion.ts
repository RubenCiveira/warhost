import { PAGINA_MM } from "../core/print";

/**
 * PDF de las vistas de impresion, en vez de confiar en el dialogo de imprimir:
 * tamano de pagina, orientacion, margenes y saltos quedan fijados en el
 * archivo, en lugar de depender de lo que cada navegador haga con `@page` o de
 * que alguien marque "graficos de fondo".
 *
 * Cada pieza se dibuja con el propio motor del navegador (modern-screenshot) a
 * escala de papel y se coloca a tamano real con jsPDF. Las dos librerias se
 * cargan solo al pulsar.
 */

/** 300 ppp: la resolucion de imprenta. Una hoja apaisada de tarot sale a unos
 *  2900 x 1700 px, que en JPEG se queda en un par de megas. */
const PPP = 300;
const PX_POR_MM = 96 / 25.4;
const ALTO_UTIL_MM = PAGINA_MM.alto - PAGINA_MM.margen * 2;

type AlAvanzar = (hecha: number, total: number) => void;
type Orientacion = "portrait" | "landscape";

/**
 * Los avatares vienen del almacenamiento de Appwrite, que pide la sesion: se
 * descargan con credenciales. Solo ellos: la hoja de fuentes de Google rechaza
 * cualquier peticion con credenciales, y entonces el PDF saldria sin fuentes.
 * Para lo demas, `false` deja que modern-screenshot lo descargue a su manera.
 */
function imagenConSesion(pieza: HTMLElement) {
  const imagenes = new Set([...pieza.querySelectorAll("img")].map((img) => img.currentSrc || img.src));
  return async (url: string): Promise<string | false> => {
    if (!imagenes.has(url)) return false;
    const respuesta = await fetch(url, { credentials: "include" });
    if (!respuesta.ok) return false;
    const datos = await respuesta.blob();
    return new Promise((listo, fallo) => {
      const lector = new FileReader();
      lector.onload = () => listo(String(lector.result));
      lector.onerror = () => fallo(lector.error);
      lector.readAsDataURL(datos);
    });
  };
}

/**
 * Pone la vista a escala de papel (`.pdf-a-escala` en styles.css: lo mismo que
 * `@media print`, pero en pantalla, que es donde se fotografia), deja que el
 * navegador recoloque y cargue fuentes, y entrega un documento A4 vacio y la
 * funcion que fotografia una pieza.
 */
async function prepararPdf(contenedor: HTMLElement, orientacion: Orientacion) {
  const [{ jsPDF }, { domToJpeg }] = await Promise.all([import("jspdf"), import("modern-screenshot")]);
  contenedor.classList.add("pdf-a-escala");
  await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
  await document.fonts.ready;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: orientacion });
  const fotografiar = (pieza: HTMLElement) =>
    domToJpeg(pieza, { scale: PPP / 96, quality: 0.92, backgroundColor: "#ffffff", fetchFn: imagenConSesion(pieza) });
  return { pdf, fotografiar };
}

const mm = (px: number) => px / PX_POR_MM;

/**
 * Modo tarjetas: cada hoja de anverso o reverso es una pagina, centrada en
 * horizontal y con el margen de arriba de `@page`, que es lo que hace que el
 * reverso caiga detras de su anverso al voltear el papel.
 */
export async function descargarPdfTarjetas(contenedor: HTMLElement, nombreArchivo: string, alAvanzar?: AlAvanzar): Promise<void> {
  const hojas = [...contenedor.querySelectorAll<HTMLElement>(".print-hoja")];
  if (hojas.length === 0) return;
  const orientacionDe = (hoja: HTMLElement): Orientacion => (hoja.closest(".print-mazo-apaisado") ? "landscape" : "portrait");
  alAvanzar?.(0, hojas.length);
  const { pdf, fotografiar } = await prepararPdf(contenedor, orientacionDe(hojas[0]));
  try {
    for (const [indice, hoja] of hojas.entries()) {
      const orientacion = orientacionDe(hoja);
      const imagen = await fotografiar(hoja);
      if (indice > 0) pdf.addPage("a4", orientacion);
      const anchoPagina = orientacion === "landscape" ? PAGINA_MM.alto : PAGINA_MM.ancho;
      const ancho = mm(hoja.offsetWidth);
      pdf.addImage(imagen, "JPEG", (anchoPagina - ancho) / 2, PAGINA_MM.margen, ancho, mm(hoja.offsetHeight));
      alAvanzar?.(indice + 1, hojas.length);
    }
    pdf.save(nombreArchivo);
  } finally {
    contenedor.classList.remove("pdf-a-escala");
  }
}

/**
 * Modo libro: las piezas (cabeceras y fichas) fluyen por paginas A4
 * verticales como al imprimir. Ninguna se parte entre dos paginas —las fichas
 * demasiado altas ya llegan divididas en dos— y una cabecera nunca se queda
 * sola al pie: salta con lo que encabeza. El hueco entre piezas y su sangria
 * salen de la propia maqueta, asi que el PDF repite lo que daria el papel.
 */
export async function descargarPdfLibro(contenedor: HTMLElement, nombreArchivo: string, alAvanzar?: AlAvanzar): Promise<void> {
  const libro = contenedor.querySelector<HTMLElement>(".print-libro");
  if (!libro) return;
  // `.print-unidad` es `display: contents`: sus hijos son piezas del libro.
  const piezas = [...libro.querySelectorAll<HTMLElement>(":scope > :not(.print-unidad), :scope > .print-unidad > *")];
  if (piezas.length === 0) return;
  alAvanzar?.(0, piezas.length);
  const { pdf, fotografiar } = await prepararPdf(contenedor, "portrait");
  try {
    // Posiciones medidas ya a escala de papel, relativas al borde de la hoja:
    // el relleno de `.print-libro` es el margen de la pagina.
    const origen = libro.getBoundingClientRect();
    const cajas = piezas.map((pieza) => {
      const caja = pieza.getBoundingClientRect();
      return { x: mm(caja.left - origen.left), arriba: mm(caja.top - origen.top), alto: mm(caja.height), ancho: mm(caja.width) };
    });
    const hueco = (i: number) => (i + 1 < cajas.length ? Math.max(0, cajas[i + 1].arriba - (cajas[i].arriba + cajas[i].alto)) : 0);
    const esCabecera = (i: number) => piezas[i].classList.contains("print-faccion-titulo");
    const fondo = PAGINA_MM.margen + ALTO_UTIL_MM;

    let y = PAGINA_MM.margen;
    for (const [i, pieza] of piezas.entries()) {
      // Una pieza mas alta que la pagina entera se encoge para caber: mejor
      // algo mas pequena que cortada.
      const escala = Math.min(1, ALTO_UTIL_MM / cajas[i].alto);
      const alto = cajas[i].alto * escala;
      const conLaSiguiente = esCabecera(i) && i + 1 < piezas.length ? hueco(i) + Math.min(cajas[i + 1].alto, ALTO_UTIL_MM) : 0;
      if (y > PAGINA_MM.margen && y + alto + conLaSiguiente > fondo) {
        pdf.addPage("a4", "portrait");
        y = PAGINA_MM.margen;
      }
      const imagen = await fotografiar(pieza);
      pdf.addImage(imagen, "JPEG", cajas[i].x, y, cajas[i].ancho * escala, alto);
      y += alto + hueco(i);
      alAvanzar?.(i + 1, piezas.length);
    }
    pdf.save(nombreArchivo);
  } finally {
    contenedor.classList.remove("pdf-a-escala");
  }
}
