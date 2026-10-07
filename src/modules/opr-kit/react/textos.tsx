"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { ArmyNoun } from "../core/gameSystems";

/**
 * Todo lo que las cartas y las vistas de impresion escriben por su cuenta. Lo
 * que viene de los datos —nombres, reglas, hechizos— no pasa por aqui: llega
 * ya en el idioma del catalogo.
 */
export interface Textos {
  // Perfil de la unidad, en la banda de la carta.
  miniaturas: string;
  calidad: string;
  defensa: string;
  heridas: string;
  puntos: string;
  combinada: string;
  // Atributos y campana de los heroes de quest.
  aguante: string;
  poder: string;
  fuerza: string;
  destreza: string;
  voluntad: string;
  nivel: string;
  experiencia: string;
  monedas: string;
  campana: string;
  habilidadesDeClase: string;
  requisito: string;
  // Tablas.
  arma: string;
  armas: string;
  alcance: string;
  ataques: string;
  cuerpoACuerpo: string;
  reglas: string;
  reglasDeArma: string;
  regla: string;
  texto: string;
  equipo: string;
  equipoAdicional: string;
  sinEquipoAdicional: string;
  concede: string;
  hechizos: string;
  hechizo: string;
  valor: string;
  efecto: string;
  ninguna: string;
  notas: string;
  mejoras: string;
  elMandoAporta: string;
  /** De quien es cada regla en la ficha de un heroe unido. */
  soloHeroe: string;
  soloUnidad: string;
  soloUnidos: string;
  liderazgo: string;
  armasOcultas: (cuantas: number) => string;
  // Opciones de configuracion.
  opciones: string;
  opcion: string;
  coste: string;
  gratis: string;
  tipo: string;
  unidad: string;
  configuracion: string;
  comoConfigurarla: string;
  secciones: (cuantas: number) => string;
  elige: (cuantas: number) => string;
  // Chips y menciones.
  ver: (nombre: string) => string;
  reglaBasica: (nombre: string) => string;
  concedeVer: (regla: string) => string;
  // Cartas Mini Euro.
  reglaEspecial: string;
  sinTexto: string;
  loLlevan: (unidades: string[]) => string;
  tirada: (umbral: number) => string;
  // Impresion.
  crearPdf: string;
  convertirPdf: string;
  preparandoPdf: string;
  pdfListo: string;
  abrirPdf: string;
  guardarPdf: string;
  cerrar: string;
  errorPdf: string;
  pdfTamanoReal: string;
  cancelar: string;
  modoLibro: string;
  modoTarjetas: string;
  sinUnidades: (noun: ArmyNoun) => string;
  sinFaccion: string;
  resumen: (puntos: number, unidades: number, miniaturas: number) => string;
  portadaConImagen: string;
  incluirTrasfondo: string;
}

const plural = (cantidad: number, singular: string, varias: string) => `${cantidad} ${cantidad === 1 ? singular : varias}`;

export const es: Textos = {
  miniaturas: "Min",
  calidad: "Cal",
  defensa: "Def",
  heridas: "Her",
  puntos: "Pts",
  combinada: "Combinada",
  aguante: "Agu",
  poder: "Pow",
  fuerza: "Str",
  destreza: "Dex",
  voluntad: "Will",
  nivel: "Nivel",
  experiencia: "Experiencia",
  monedas: "Monedas",
  campana: "Campaña",
  habilidadesDeClase: "Habilidades de clase",
  requisito: "Req.",
  arma: "Arma",
  armas: "Armas",
  alcance: "Alc.",
  ataques: "Atq.",
  cuerpoACuerpo: "CaC",
  reglas: "Reglas",
  reglasDeArma: "Reglas de arma",
  regla: "Regla",
  texto: "Texto",
  equipo: "Equipo",
  equipoAdicional: "Equipo adicional",
  sinEquipoAdicional: "Sin equipo adicional.",
  concede: "Concede",
  hechizos: "Hechizos",
  hechizo: "Hechizo",
  valor: "Valor",
  efecto: "Efecto",
  ninguna: "Ninguna",
  notas: "Notas",
  mejoras: "Mejoras",
  elMandoAporta: "El mando aporta",
  soloHeroe: "sólo héroe",
  soloUnidad: "sólo unidad",
  soloUnidos: "sólo unidos",
  liderazgo: "Liderazgo",
  armasOcultas: (cuantas) => `y ${cuantas} arma${cuantas === 1 ? "" : "s"} mas, en el detalle de la unidad`,
  opciones: "Opciones",
  opcion: "Opcion",
  coste: "Coste",
  gratis: "gratis",
  tipo: "Tipo",
  unidad: "Unidad",
  configuracion: "configuracion",
  comoConfigurarla: "Como configurarla",
  secciones: (cuantas) => `(${cuantas} secciones)`,
  elige: (cuantas) => `elige ${cuantas === 1 ? "una" : cuantas}`,
  ver: (nombre) => `Ver ${nombre}`,
  reglaBasica: (nombre) => `${nombre}: regla del reglamento basico`,
  concedeVer: (regla) => `Concede ${regla}: ver la regla`,
  reglaEspecial: "Regla especial",
  sinTexto: "No hay texto para esta regla, ni en los libros de faccion ni en el reglamento basico.",
  loLlevan: (unidades) => `Lo llevan ${unidades.slice(0, 3).join(", ")}${unidades.length > 3 ? ` y ${unidades.length - 3} mas` : ""}`,
  tirada: (umbral) => `Tira 1D6: iguala o supera ${umbral}`,
  crearPdf: "Crear PDF",
  convertirPdf: "Convertir a PDF",
  preparandoPdf: "Preparando el PDF…",
  pdfListo: "PDF listo",
  abrirPdf: "Abrir",
  guardarPdf: "Guardar",
  cerrar: "Cerrar",
  errorPdf: "No se pudo generar el PDF. Vuelve a intentarlo; si sigue fallando, usa Imprimir del navegador.",
  pdfTamanoReal: "Imprime el PDF a tamaño real (100 %), sin «ajustar a la página»: así todo sale a su medida real.",
  cancelar: "Cancelar",
  modoLibro: "Modo libro",
  modoTarjetas: "Modo tarjetas con dorso",
  sinUnidades: (noun) => `${noun.demonstrativeCap} ${noun.singular} no tiene unidades que imprimir.`,
  sinFaccion: "Sin faccion",
  resumen: (puntos, unidades, miniaturas) =>
    [plural(puntos, "punto", "puntos"), plural(unidades, "unidad", "unidades"), plural(miniaturas, "miniatura", "miniaturas")].join(" · "),
  portadaConImagen: "Portada con nombre e imagen",
  incluirTrasfondo: "Incluir el trasfondo de la faccion",
};

export const en: Textos = {
  miniaturas: "Mod",
  calidad: "Qua",
  defensa: "Def",
  heridas: "Wnd",
  puntos: "Pts",
  combinada: "Combined",
  aguante: "Tgh",
  poder: "Pow",
  fuerza: "Str",
  destreza: "Dex",
  voluntad: "Will",
  nivel: "Level",
  experiencia: "Experience",
  monedas: "Coins",
  campana: "Campaign",
  habilidadesDeClase: "Class skills",
  requisito: "Req.",
  arma: "Weapon",
  armas: "Weapons",
  alcance: "Rng",
  ataques: "Atk",
  cuerpoACuerpo: "Melee",
  reglas: "Rules",
  reglasDeArma: "Weapon rules",
  regla: "Rule",
  texto: "Text",
  equipo: "Gear",
  equipoAdicional: "Extra gear",
  sinEquipoAdicional: "No extra gear.",
  concede: "Grants",
  hechizos: "Spells",
  hechizo: "Spell",
  valor: "Value",
  efecto: "Effect",
  ninguna: "None",
  notas: "Notes",
  mejoras: "Upgrades",
  elMandoAporta: "Leader grants",
  soloHeroe: "hero only",
  soloUnidad: "unit only",
  soloUnidos: "joined only",
  liderazgo: "Leadership",
  armasOcultas: (cuantas) => `and ${cuantas} more weapon${cuantas === 1 ? "" : "s"}, in the unit details`,
  opciones: "Options",
  opcion: "Option",
  coste: "Cost",
  gratis: "free",
  tipo: "Type",
  unidad: "Unit",
  configuracion: "configuration",
  comoConfigurarla: "How to configure it",
  secciones: (cuantas) => `(${cuantas} sections)`,
  elige: (cuantas) => `pick ${cuantas === 1 ? "one" : cuantas}`,
  ver: (nombre) => `See ${nombre}`,
  reglaBasica: (nombre) => `${nombre}: core rulebook rule`,
  concedeVer: (regla) => `Grants ${regla}: see the rule`,
  reglaEspecial: "Special rule",
  sinTexto: "There is no text for this rule, neither in the army books nor in the core rulebook.",
  loLlevan: (unidades) => `Carried by ${unidades.slice(0, 3).join(", ")}${unidades.length > 3 ? ` and ${unidades.length - 3} more` : ""}`,
  tirada: (umbral) => `Roll 1D6: ${umbral}+`,
  crearPdf: "Create PDF",
  convertirPdf: "Convert to PDF",
  preparandoPdf: "Preparing the PDF…",
  pdfListo: "PDF ready",
  abrirPdf: "Open",
  guardarPdf: "Save",
  cerrar: "Close",
  errorPdf: "The PDF could not be generated. Try again; if it keeps failing, use the browser's Print.",
  pdfTamanoReal: "Print the PDF at actual size (100%), not \"fit to page\", so everything comes out at its real size.",
  cancelar: "Cancel",
  modoLibro: "Book mode",
  modoTarjetas: "Cards with backs",
  sinUnidades: (noun) => `This ${noun.singular} has no units to print.`,
  sinFaccion: "No faction",
  resumen: (puntos, unidades, miniaturas) =>
    [plural(puntos, "point", "points"), plural(unidades, "unit", "units"), plural(miniaturas, "model", "models")].join(" · "),
  portadaConImagen: "Cover with name and image",
  incluirTrasfondo: "Include the faction background",
};

const TextosContext = createContext<Textos>(es);

/** Cambia los textos de todo lo que haya dentro; lo que no se pase sale en espanol. */
export function TextosProvider({ textos, children }: { textos: Partial<Textos>; children: ReactNode }) {
  return <TextosContext.Provider value={{ ...es, ...textos }}>{children}</TextosContext.Provider>;
}

export function useTextos(): Textos {
  return useContext(TextosContext);
}
