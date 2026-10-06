/**
 * El glosario de reglas a partir de los datos de Army Forge, para quien tenga
 * los libros pero no un catalogo de reglas propio.
 */
import type { ForgeArmyBook, ForgeSpecialRule } from "./armyForgeResolve";
import type { CatalogRule } from "./model";

/** Lo que publica Army Forge en `/api/rules/common/:sistema`. */
export interface ForgeCommonRules {
  rules?: ForgeSpecialRule[];
}

/**
 * Junta las reglas que describen los libros (`specialRules`) y las del
 * reglamento (`comunes`), indexadas por nombre en minusculas como las busca
 * el resto del paquete.
 *
 * Un libro solo describe las suyas y las comunes que usan sus unidades: sin
 * las comunes se quedan sin texto las que solo aparecen en mejoras o en otras
 * reglas. Donde las dos fuentes describen la misma, manda la comun, que es la
 * del reglamento. Con una lista de aliados se pasan todos sus libros.
 */
export function glosarioDesdeLibros(libros: Iterable<ForgeArmyBook>, comunes?: ForgeCommonRules): Map<string, CatalogRule> {
  const glosario = new Map<string, CatalogRule>();
  const anadir = (regla: ForgeSpecialRule) => {
    // Army Forge trae alguna entrada de mantenimiento, como "Sniper REMOVE".
    if (!regla.name || !regla.description || /\bREMOVE\b/.test(regla.name)) return;
    const clave = regla.name.toLowerCase();
    if (glosario.has(clave)) return;
    glosario.set(clave, {
      name: regla.name,
      description: regla.description,
      coreType: typeof regla.coreType === "number" ? regla.coreType : null,
    });
  };
  for (const regla of comunes?.rules ?? []) anadir(regla);
  for (const libro of libros) for (const regla of libro.specialRules ?? []) anadir(regla);
  return glosario;
}
