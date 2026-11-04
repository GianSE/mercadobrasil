import { Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { useTema } from "../lib/tema";
import { Button } from "./ui/button";

export function Cabecalho() {
  const { tema, alternar } = useTema();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">MB</span>
          Mercado Brasil
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
