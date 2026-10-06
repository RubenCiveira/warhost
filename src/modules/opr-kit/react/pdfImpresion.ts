/**
 * Lo que se hace con un PDF ya generado: abrirlo o guardarlo. Quien lo genera
 * pregunta antes cual, porque las dos cosas necesitan un clic propio para
 * poder abrir una pestaña o el dialogo de guardar.
 */

/** La pestaña o la descarga leen la URL despues de devolverla: se libera mas
 *  tarde, no en el acto. */
const LIBERAR_URL_MS = 60_000;

function descargar(pdf: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(pdf);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), LIBERAR_URL_MS);
}

/**
 * Abre el PDF en una pestaña nueva, con el visor del navegador. Hay que
 * llamarla desde un clic: fuera de el, el bloqueador de ventanas emergentes la
 * para, y entonces se descarga. Sin `noopener`, que haria que `window.open`
 * devolviera siempre null y no se sabria si la han bloqueado.
 */
export function abrirPdf(pdf: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(pdf);
  const pestana = window.open(url, "_blank");
  if (!pestana) descargar(pdf, nombreArchivo);
  setTimeout(() => URL.revokeObjectURL(url), LIBERAR_URL_MS);
}

type SelectorGuardar = (opciones: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<FileSystemFileHandle>;

/**
 * Guarda el PDF: con el dialogo nativo de "Guardar como" donde existe (Chrome y
 * Edge de escritorio) y, si no, como una descarga normal. Devuelve false si se
 * cancela el dialogo, para que quien llama no de el PDF por guardado. Tambien
 * hay que llamarla desde un clic: el dialogo lo exige.
 */
export async function guardarPdf(pdf: Blob, nombreArchivo: string): Promise<boolean> {
  const conSelector = window as Window & { showSaveFilePicker?: SelectorGuardar };
  if (conSelector.showSaveFilePicker) {
    try {
      // Como metodo de `window`: suelta, la funcion da "Illegal invocation".
      const destino = await conSelector.showSaveFilePicker({
        suggestedName: nombreArchivo,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const escritura = await destino.createWritable();
      await escritura.write(pdf);
      await escritura.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      // Cualquier otro fallo (permisos, disco): mejor una descarga que nada.
      console.error(error);
    }
  }
  descargar(pdf, nombreArchivo);
  return true;
}
