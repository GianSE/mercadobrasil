import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { AvisoPWA } from "./components/AvisoPWA";
import { Cabecalho, Rodape } from "./components/Cabecalho";
import { ProvedorTema } from "./lib/tema";
import { Inicio } from "./paginas/Inicio";

// A página de área traz o ECharts; a inicial não precisa dele.
const Area = lazy(() => import("./paginas/Area").then((m) => ({ default: m.Area })));

/**
 * Cada página nova começa no topo; com âncora no endereço (#ocupacao), rola até
 * ela. A seção chega carregada sob demanda, então a âncora é procurada por
 * alguns instantes antes de desistir.
 */
function VoltaAoTopo() {
  const [local] = useLocation();
  useEffect(() => {
    const ancora = window.location.hash.slice(1);
    if (!ancora) {
      window.scrollTo(0, 0);
      return;
    }
    let tentativas = 0;
    const procurar = window.setInterval(() => {
      const alvo = document.getElementById(ancora);
      if (alvo || ++tentativas > 30) {
        window.clearInterval(procurar);
        alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
    return () => window.clearInterval(procurar);
  }, [local]);
  return null;
}

export function App() {
  return (
    <ProvedorTema>
      <div className="flex min-h-dvh flex-col">
        <VoltaAoTopo />
        <Cabecalho />
        <div className="flex-1">
          <Suspense>
            <Switch>
              <Route path="/" component={Inicio} />
              <Route path="/:slug/:secao?">{(p) => <Area slug={p.slug} secao={p.secao} />}</Route>
            </Switch>
          </Suspense>
        </div>
        <Rodape />
        <AvisoPWA />
      </div>
    </ProvedorTema>
  );
}
