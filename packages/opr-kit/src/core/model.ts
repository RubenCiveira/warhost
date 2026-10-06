/**
 * Lo que la logica necesita saber del catalogo, sin atarse a quien lo guarda.
 *
 * Cada aplicacion tiene sus filas con sus campos de mas —ids de base de datos,
 * marcas de sincronizacion—; aqui solo va lo que se lee de verdad, para que
 * cualquier fila que lo lleve encaje sin copiarla.
 */
export interface ArmyBook {
  /** Reglas que publica este libro; el glosario es comun y no lo dice. */
  ruleNames: string[];
}

export interface ArmyUnit {
  name: string;
  rules: string[];
  weapons: string | null;
  items: string | null;
}

export interface CatalogRule {
  name: string;
  description: string;
  /**
   * Marcado en las reglas del reglamento —AP, Ambush, Deadly— y nulo en las que
   * publica la faccion. Es lo que separa "las reglas de esta faccion" del resto.
   */
  coreType: number | null;
}

export type HeroSkillStat = "strength" | "dexterity" | "willpower";

/** Una habilidad de heroe de Quest: de clase (tiers 0-3) o del set comun a todas. */
export interface HeroSkill {
  tier: 0 | 1 | 2 | 3;
  stat: HeroSkillStat;
  name: string;
  description: string;
  sortOrder: number;
}

/**
 * Una clase de heroe de Quest (Star Quest / Fantasy Quest). `classKey` es el
 * slug estable que empareja la misma clase entre sistemas con nombres
 * distintos (p.ej. "berserker" es Berserker en GFSQ y Barbarian en AoFQ).
 */
export interface HeroClass {
  /** Lo que guarda `heroClassId` en las unidades para recordar la clase elegida. */
  id: string;
  classKey: string;
  /** Lista de `HeroSkill`, serializada en JSON. */
  skills: string;
  /**
   * Que atributos (Fuerza/Destreza/Voluntad) mejora esta clase gratis al
   * crear el heroe, antes de subir ningun nivel. Transcrito del creador de
   * heroes de Army Forge: cada clase trae 2 elecciones fijas.
   */
  abilityChoices: string[];
  /**
   * Que mejoras de combate (las mismas opciones que al subir de nivel, ver
   * `HeroCombatStatChoice`) trae esta clase gratis al crear el heroe.
   */
  combatStatChoices: string[];
  /** Habilidades de clase que Army Forge concede gratis al crear el heroe. */
  skillChoices: string[];
}

export interface QuestShopPackage {
  /** Lista de `UpgradeSection`, serializada en JSON. */
  sections: string;
  classKeys: string[];
  requiresCaster: boolean;
  minTough: number | null;
  maxTough: number | null;
}

export function parseHeroSkills(raw: string | null | undefined): HeroSkill[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HeroSkill[]) : [];
  } catch {
    return [];
  }
}
