import { useEffect } from "react";
import { NODE_KINDS, serializeModel } from "@arquitecture/core";
import { Canvas } from "./Canvas.js";
import { Sidebar } from "./Sidebar.js";
import { breadcrumb } from "./lib/route.js";
import {
  KIND_LABEL,
  cancelRemove,
  confirmRemove,
  createNode,
  currentLevel,
  dismissToast,
  load,
  navigate,
  onHashChange,
  setTab,
  undo,
  useStore,
} from "./store.js";

function TopBar() {
  const model = useStore((s) => s.model)!;
  const path = useStore((s) => s.path);
  const tab = useStore((s) => s.tab);
  const crumbs = breadcrumb(model, currentLevel({ model, path }));
  return (
    <div className="topbar">
      <nav className="crumbs" data-testid="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.id ?? "root"}>
            {i > 0 && " / "}
            <button disabled={i === crumbs.length - 1} onClick={() => navigate(c.id)}>{c.name}</button>
          </span>
        ))}
      </nav>
      <div className="tabs">
        <button className={tab === "diagram" ? "active" : ""} onClick={() => setTab("diagram")} data-testid="tab-diagram">Diagrama</button>
        <button className={tab === "json" ? "active" : ""} onClick={() => setTab("json")} data-testid="tab-json">JSON</button>
      </div>
    </div>
  );
}

function Palette() {
  return (
    <div className="palette" data-testid="palette">
      <span className="muted">Criar:</span>
      {NODE_KINDS.map((k) => (
        <button key={k} style={{ "--c": `var(--kind-${k})` } as React.CSSProperties} data-testid={`add-${k}`} onClick={() => void createNode(k)}>
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function Editor() {
  const tab = useStore((s) => s.tab);
  const model = useStore((s) => s.model)!;
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <TopBar />
        {tab === "diagram" ? (
          <>
            <Palette />
            <Canvas />
          </>
        ) : (
          <pre className="json" data-testid="json">{serializeModel(model)}</pre>
        )}
      </main>
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.tone} data-testid="toast">
          <span>{t.text}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Fechar">×</button>
        </div>
      ))}
    </div>
  );
}

function ConfirmRemove() {
  const req = useStore((s) => s.removeRequest);
  const model = useStore((s) => s.model);
  if (!req || !model) return null;
  const name = model.nodes.find((n) => n.id === req.nodeId)?.name ?? req.nodeId;
  return (
    <div className="overlay">
      <div className="dialog" role="alertdialog" data-testid="confirm-remove">
        <strong>Remover «{name}»?</strong>
        <p>
          Serão removidos {req.nodes} {req.nodes === 1 ? "nó" : "nós"} e {req.edges} {req.edges === 1 ? "conexão" : "conexões"}.
          Ctrl+Z desfaz a remoção.
        </p>
        <div className="row">
          <button onClick={cancelRemove} data-testid="confirm-cancel">Cancelar</button>
          <button className="danger" onClick={() => void confirmRemove()} data-testid="confirm-ok">Remover</button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const status = useStore((s) => s.status);
  const errors = useStore((s) => s.errors);

  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input,textarea,select");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        void undo();
      }
    };
    addEventListener("hashchange", onHashChange);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("hashchange", onHashChange);
      removeEventListener("keydown", onKey);
    };
  }, []);

  let body: React.ReactNode;
  if (status === "loading") body = <div className="fullscreen" data-testid="loading">Carregando…</div>;
  else if (status === "unreachable") {
    body = (
      <div className="fullscreen" data-testid="unreachable">
        <h1>Servidor inacessível</h1>
        <p>Não foi possível falar com o servidor local. Verifique se ele está em execução.</p>
        <button onClick={() => void load()}>Tentar de novo</button>
      </div>
    );
  } else if (status === "invalid") {
    body = (
      <div className="fullscreen" data-testid="invalid">
        <h1>Modelo inválido</h1>
        <p>O arquivo docs/architecture.json tem erros. Corrija-o ou restaure-o com o Git e reinicie a ferramenta. Nenhuma edição é possível enquanto isso.</p>
        <ul>
          {errors.map((e, i) => (
            <li key={i}>
              <strong>{e.code}</strong> em <code>{e.path || "/"}</code>: {e.message}
              <br />
              <span className="muted">{e.hint}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  } else body = <Editor />;

  return (
    <>
      {body}
      <ConfirmRemove />
      <Toasts />
    </>
  );
}
