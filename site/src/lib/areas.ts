import { BriefcaseBusiness, Cpu, DraftingCompass, Factory, GraduationCap, HardHat, HeartPulse, Landmark, Store, Truck, Wheat, type LucideIcon } from "lucide-react";
import lista from "../areas.json";

/*
 * As áreas vêm de tasks-python/_utils/areas.py, exportadas para areas.json
 * por tasks-python/_utils/exportar_areas.py (npm run areas). O site não tem
 * nenhuma área escrita no código: só o ícone de cada uma, que é apresentação.
 */
/** O formato que tasks-python/_utils/exportar_areas.py grava em areas.json. */
export type Area = {
  slug: string;
  nome: string;
  sigla: string;
  resumo: string;
  repo: string;
  subareas: string[];
  /** família CBO (4 dígitos) -> nome */
  familias: Record<string, string>;
  /** código CBO avulso (6 dígitos) -> nome */
  avulsos: Record<string, string>;
  cnaes: number;
  familias_cbo: number;
  rotulos: { setor_dentro: string; setor_fora: string; lente_dentro: string; lente_fora: string; lente_so_setor: string; nao_area: string };
};

// O TypeScript infere o JSON como a união das sete áreas, com as famílias de
// todas como chaves opcionais; o formato real é o declarado acima, garantido
// pelo exportador.
export const AREAS = lista as unknown as Area[];

export function acharArea(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

const ICONES: Record<string, LucideIcon> = {
  tec: Cpu,
  saude: HeartPulse,
  educacao: GraduationCap,
  financas: Landmark,
  agronegocio: Wheat,
  comercio: Store,
  industria: Factory,
  construcao: HardHat,
  logistica: Truck,
  engenharia: DraftingCompass,
};

export function iconeDa(area: Area): LucideIcon {
  return ICONES[area.slug] ?? BriefcaseBusiness;
}
