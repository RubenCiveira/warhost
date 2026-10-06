import { useSyncExternalStore } from "react";
import { env } from "./env";

/**
 * Sin red, o con una tan mala que esperar al servidor es peor que no tenerlo.
 * Lo lanza el cliente de Appwrite en vez de llamar: quien pueda tirar de la
 * copia local la captura, y para el resto es un error mas que ensenar.
 */
export class SinCoberturaError extends Error {
  constructor() {
    super("Sin cobertura: esto necesita conexion con el servidor.");
    this.name = "SinCoberturaError";
  }
}

/** Lo que tarda como mucho una lectura antes de darse por perdida. */
export const LIMITE_LECTURA_MS = 10_000;
/** Cada cuanto se comprueba si ha vuelto la cobertura tras un fallo. */
const SONDEO_MS = 30_000;
const LIMITE_SONDEO_MS = 5_000;

/** Solo Chrome y Android la exponen: en Safari la mala cobertura se nota al fallar. */
interface InformacionDeRed extends EventTarget {
  effectiveType?: string;
}
const red = (navigator as Navigator & { connection?: InformacionDeRed }).connection;

let fallo = false;
let sondeo: number | null = null;
let estado = calcular();
const oyentes = new Set<() => void>();

function calcular(): boolean {
  const lenta = red?.effectiveType === "slow-2g" || red?.effectiveType === "2g";
  return navigator.onLine && !lenta && !fallo;
}

function avisar() {
  const nuevo = calcular();
  if (nuevo === estado) return;
  estado = nuevo;
  oyentes.forEach((oyente) => oyente());
}

export function hayCobertura(): boolean {
  return estado;
}

/** Una llamada ha fallado por la red o ha tardado demasiado: se deja de llamar hasta que vuelva. */
export function marcarSinCobertura() {
  fallo = true;
  avisar();
  sondeo ??= window.setInterval(() => void reintentar(), SONDEO_MS);
}

/**
 * Pregunta al servidor si responde a tiempo. Va por fuera del cliente de
 * Appwrite precisamente porque este no llama mientras no haya cobertura.
 */
export async function reintentar(): Promise<void> {
  try {
    // Sin la cabecera del proyecto el CORS no deja leer la respuesta, pero
    // para saber que el servidor contesta a tiempo basta con que llegue.
    await fetch(`${env.endpoint}/health/version`, {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(LIMITE_SONDEO_MS),
    });
  } catch {
    return;
  }
  fallo = false;
  if (sondeo !== null) window.clearInterval(sondeo);
  sondeo = null;
  avisar();
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

window.addEventListener("online", avisar);
window.addEventListener("offline", avisar);
red?.addEventListener("change", avisar);

export function useCobertura(): boolean {
  return useSyncExternalStore(suscribir, hayCobertura);
}
