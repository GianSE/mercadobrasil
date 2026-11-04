import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { Cabecalho, Rodape } from "./components/Cabecalho";
import { ProvedorTema } from "./lib/tema";
import { Inicio } from "./paginas/Inicio";

// A página de área traz o ECharts; a inicial não precisa dele.
const Area = lazy(() => import("./paginas/Area").then((m) => ({ default: m.Area })));

function VoltaAoTopo() {
  const [local] = useLocation();
  useEffect(() => window.scrollTo(0, 0), [local]);
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
      </div>
    </ProvedorTema>
  );
}
