const inteiro = new Intl.NumberFormat("pt-BR");
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sm = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = {
  inteiro: (n: number) => inteiro.format(Math.round(n)),
  compacto: (n: number) => compacto.format(n),
  /** 0.0423 -> "+4,2%" */
  variacao: (v: number) => `${v > 0 ? "+" : ""}${decimal.format(v * 100)}%`,
  /** 0.39 -> "39,0%" */
  parte: (v: number) => `${decimal.format(v * 100)}%`,
  sm: (n: number) => `${sm.format(n)} SM`,
  data: (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
};
