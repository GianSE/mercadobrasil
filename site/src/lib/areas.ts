import { BriefcaseBusiness, Cpu, GraduationCap, HeartPulse, type LucideIcon } from "lucide-react";
import lista from "../areas.json";

/*
 * As áreas vêm de tasks-python/_utils/areas.py, exportadas para areas.json
 * por tasks-python/_utils/exportar_areas.py (npm run areas). O site não tem
 * nenhuma área escrita no código: só o ícone de cada uma, que é apresentação.
 */
export type Area = (typeof lista)[number];

export const AREAS: Area[] = lista;

export function acharArea(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}

const ICONES: Record<string, LucideIcon> = {
  tec: Cpu,
  saude: HeartPulse,
  educacao: GraduationCap,
};

export function iconeDa(area: Area): LucideIcon {
  return ICONES[area.slug] ?? BriefcaseBusiness;
}
