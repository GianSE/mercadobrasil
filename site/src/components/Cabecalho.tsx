import { Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { useTema } from "../lib/tema";
import { LogoAnimado } from "./marca/LogoAnimado";
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

export function Rodape() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        Fonte: RAIS e CAGED, Ministério do Trabalho e Emprego (PDET). Dados tratados e abertos no{" "}
        <a className="underline underline-offset-4 hover:text-foreground" href="https://huggingface.co/Gianpedro">
          Hugging Face
        </a>
        .
      </div>
    </footer>
  );
}
