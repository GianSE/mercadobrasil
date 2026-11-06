import { Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { useTema } from "../lib/tema";
import { LogoAnimado } from "./marca/LogoAnimado";
import { ICONES_REDES } from "./marca/redes";
import { Button } from "./ui/button";

export function Cabecalho() {
  const { tema, alternar } = useTema();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* No layout, e não em cada página: a logo anima ao carregar e ao passar
            o mouse, e não de novo a cada troca de rota. */}
        <Link href="/" aria-label="Mercado Brasil, página inicial" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <LogoAnimado />
        </Link>
        <Button variant="ghost" size="icon" onClick={alternar} aria-label={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}>
          {tema === "escuro" ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  );
}

const REDES = [
  { chave: "github", href: "https://github.com/GianSE/", rotulo: "GitHub" },
  { chave: "linkedin", href: "https://www.linkedin.com/in/gian-pedro-rodrigues-3b6a44259/", rotulo: "LinkedIn" },
  { chave: "huggingface", href: "https://huggingface.co/Gianpedro/", rotulo: "Hugging Face" },
] as const;

function IconeRede({ rede }: { rede: keyof typeof ICONES_REDES }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden>
      <path d={ICONES_REDES[rede].caminho} />
    </svg>
  );
}

export function Rodape() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">
          Fonte: RAIS e CAGED, Ministério do Trabalho e Emprego (PDET). Dados tratados e abertos no{" "}
          <a className="underline underline-offset-4 hover:text-foreground" href="https://huggingface.co/Gianpedro/" target="_blank" rel="noopener noreferrer">
            Hugging Face
          </a>
          .
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Gian Pedro Rodrigues nas redes">
          {REDES.map((r) => (
            <li key={r.chave}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3 text-foreground transition-colors outline-none hover:border-foreground/30 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <IconeRede rede={r.chave} />
                {r.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
