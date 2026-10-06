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
  imprimir: string;
  imprimirTitulo: (nombre: string) => string;
  cancelar: string;
  volverAElegir: string;
  eligeModo: (noun: ArmyNoun) => string;
  modoLibro: string;
  modoLibroAyuda: string;
  modoTarjetas: string;
  modoTarjetasAyuda: string;
  sinUnidades: (noun: ArmyNoun) => string;
  sinFaccion: string;
  resumen: (puntos: number, unidades: number, miniaturas: number) => string;
  fichaDividida: string;
  mazoUnidades: string;
  mazoCartas: string;
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
  imprimir: "Imprimir",
  imprimirTitulo: (nombre) => `Imprimir ${nombre}`,
  cancelar: "Cancelar",
  volverAElegir: "← Volver a elegir",
  eligeModo: (noun) => `Elige como quieres imprimir las cartas de ${noun.demonstrative} ${noun.singular}.`,
  modoLibro: "Modo libro",
  modoLibroAyuda:
    "Tarjetas grandes de unidad con armas, equipo, hechizos y el texto de sus reglas especiales. La impresion llena cada pagina con las tarjetas que quepan y divide las unidades demasiado largas.",
  modoTarjetas: "Modo tarjetas con dorso",
  modoTarjetasAyuda:
    "Cada carta sale una sola vez, pensado para plastificar y recortar: hojas de anverso seguidas de su hoja de reverso. Imprime primero las hojas impares, voltea el papel por el borde largo y vuelve a imprimir las pares.",
  sinUnidades: (noun) => `${noun.demonstrativeCap} ${noun.singular} no tiene unidades que imprimir.`,
  sinFaccion: "Sin faccion",
  resumen: (puntos, unidades, miniaturas) =>
    [plural(puntos, "punto", "puntos"), plural(unidades, "unidad", "unidades"), plural(miniaturas, "miniatura", "miniaturas")].join(" · "),
  fichaDividida: "Ficha dividida para no recortar esta unidad al imprimir.",
  mazoUnidades: "Unidades",
  mazoCartas: "Habilidades, equipo, hechizos y reglas generales",
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
  imprimir: "Print",
  imprimirTitulo: (nombre) => `Print ${nombre}`,
  cancelar: "Cancel",
  volverAElegir: "← Back",
  eligeModo: (noun) => `Choose how to print the cards of this ${noun.singular}.`,
  modoLibro: "Book mode",
  modoLibroAyuda:
    "Large unit cards with weapons, gear, spells and the full text of their special rules. Each page is filled with as many cards as fit, and units that are too long are split.",
  modoTarjetas: "Cards with backs",
  modoTarjetasAyuda:
    "Every card is printed once, ready to laminate and cut: front sheets followed by their back sheet. Print the odd sheets first, flip the paper on the long edge and print the even ones.",
  sinUnidades: (noun) => `This ${noun.singular} has no units to print.`,
  sinFaccion: "No faction",
  resumen: (puntos, unidades, miniaturas) =>
    [plural(puntos, "point", "points"), plural(unidades, "unit", "units"), plural(miniaturas, "model", "models")].join(" · "),
  fichaDividida: "Card split so this unit is not cut off when printed.",
  mazoUnidades: "Units",
  mazoCartas: "Abilities, gear, spells and core rules",
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
