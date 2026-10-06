import { Document, Image, Page, Text, View, pdf } from "@react-pdf/renderer";
import type { ArmyBook, ArmyUnit, CatalogRule } from "../core/model";
import { sectionsForUnit } from "../core/builder";
import type { UpgradeSection } from "../core/builder";
import { baseLoadout } from "../core/loadout";
import { agruparUnidades } from "../core/unidades";
import { puedeTenerCaster } from "../core/faccion";
import { parseSpells, reglasMencionadasEnHechizos } from "../core/spells";
import {
  FichaOpcionesPdf,
  FichaUnidadPdf,
  Lore,
  PAPEL,
  Pie,
  TEMAS,
  Tabla,
  TablaHechizos,
  estilosDe,
  imagenParaPdf,
  imagenesParaPdf,
  mm,
  registrarFuentes,
} from "./pdfComun";
import type { Ambientacion } from "./pdfComun";
import type { Textos } from "./textos";

export interface OpcionesPdfFaccion {
  book: ArmyBook;
  units: ArmyUnit[];
  packages: Map<string, UpgradeSection[]>;
  glosario: Map<string, CatalogRule>;
  t: Textos;
  /** Imagen de la portada; sin ella, la portada sale solo con el nombre. */
  coverUrl: string | null;
  miniaturaDe?: (unit: ArmyUnit) => string | null;
  portada: boolean;
  incluirLore: boolean;
  ambientacion: Ambientacion;
}

/** El libro de una faccion: portada, trasfondo, una ficha por unidad seguida
 *  de sus opciones y, si alguna puede lanzarlos, los hechizos. */
export async function generarPdfFaccion({
  book,
  units,
  packages,
  glosario,
  t,
  coverUrl,
  miniaturaDe,
  portada,
  incluirLore,
  ambientacion,
}: OpcionesPdfFaccion): Promise<Blob> {
  registrarFuentes();
  const s = estilosDe(TEMAS[ambientacion]);
  const unidades = agruparUnidades(units).flatMap((grupo) => grupo.unidades);
  const hechizos = parseSpells(book.spells ?? null);
  const lanzan = new Set(unidades.filter((unit) => puedeTenerCaster(unit, sectionsForUnit(unit, packages))).map((unit) => unit.unitId));
  const reglasDeHechizos = lanzan.size > 0 ? reglasMencionadasEnHechizos(glosario, hechizos) : [];

  // Las miniaturas miden 40 mm de alto (unos 200 ppp); la portada, todo el ancho util.
  const [imagenPortada, miniaturas] = await Promise.all([
    portada && coverUrl ? imagenParaPdf(coverUrl, 1600, "#ffffff") : null,
    imagenesParaPdf(unidades.map((unit) => miniaturaDe?.(unit)), 700, PAPEL),
  ]);
  const conLore = incluirLore && Boolean(book.lore);

  const documento = (
    <Document title={book.name}>
      {portada ? (
        <Page size="A4" style={s.pagina}>
          <Text style={s.titulo}>{book.name}</Text>
          {imagenPortada ? <Image style={s.portada} src={imagenPortada} /> : null}
        </Page>
      ) : null}
      {conLore && book.lore ? (
        <Page size="A4" style={s.pagina}>
          {portada ? null : <Text style={s.titulo}>{book.name}</Text>}
          <Lore s={s} texto={book.lore} estilo={s.lore} />
          <Pie s={s} texto={book.name} />
        </Page>
      ) : null}
      <Page size="A4" style={s.pagina}>
        {portada || conLore ? null : <Text style={s.titulo}>{book.name}</Text>}
        {unidades.map((unit) => (
          <View key={unit.unitId} style={s.unidad}>
            <FichaUnidadPdf
              s={s}
              t={t}
              unit={{ ...unit, maxWounds: 1, loadout: baseLoadout(unit.weapons, unit.items) }}
              glosario={glosario}
              hechizos={lanzan.has(unit.unitId) ? hechizos : []}
              miniatura={miniaturas.get(miniaturaDe?.(unit) ?? "") ?? null}
              lore={unit.lore}
            />
            {sectionsForUnit(unit, packages).map((section) => (
              <FichaOpcionesPdf
                key={section.id ?? section.uid}
                s={s}
                t={t}
                nombre={unit.name}
                unitId={unit.unitId}
                section={section}
                glosario={glosario}
              />
            ))}
          </View>
        ))}
        {lanzan.size > 0 && hechizos.length > 0 ? (
          <View>
            <Text style={s.seccion} minPresenceAhead={mm(30)}>
              {t.hechizos}
            </Text>
            <TablaHechizos s={s} t={t} hechizos={hechizos} />
            {reglasDeHechizos.length > 0 ? (
              <View style={{ marginTop: mm(4) }}>
                <Tabla
                  s={s}
                  columnas={[
                    { titulo: t.regla, ancho: "24%" },
                    { titulo: t.texto, ancho: "76%" },
                  ]}
                  filas={reglasDeHechizos.map((regla) => ({ key: regla.name, celdas: [regla.name, regla.description] }))}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        <Pie s={s} texto={book.name} />
      </Page>
    </Document>
  );
  return pdf(documento).toBlob();
}
