import { useEffect, useState } from "react";
import { EDGE_KINDS, NODE_KINDS } from "@arquitecture/core";
import type { ArchEdge, ArchNode, ArchitectureModel } from "@arquitecture/core";
import { TECH_KEYS } from "./lib/icons.js";
import { projectEdges } from "./lib/projection.js";
import { KIND_LABEL, currentLevel, exec, findEdge, findNode, navigate, requestRemove, select, useStore } from "./store.js";

function Tree({ model }: { model: ArchitectureModel }) {
  const selection = useStore((s) => s.selection);
  const render = (parent: string | null, depth: number): React.ReactNode =>
    model.nodes
      .filter((n) => n.parent === parent)
      .map((n) => (
        <div key={n.id}>
          <div
            className={"tree-item" + (selection?.kind === "node" && selection.id === n.id ? " selected" : "")}
            style={{ paddingLeft: 6 + depth * 14 }}
            data-testid={`tree-${n.id}`}
            onClick={() => {
              // Mostra o nó no nível em que ele aparece (o do pai) e seleciona.
              navigate(n.parent);
              select({ kind: "node", id: n.id });
            }}
          >
            <span className="tree-dot" style={{ background: `var(--kind-${n.kind})` }} />
            {n.name}
          </div>
          {render(n.id, depth + 1)}
        </div>
      ));
  return <div className="tree" data-testid="tree">{model.nodes.length ? render(null, 0) : <p className="muted" style={{ padding: 8 }}>Nenhum nó ainda.</p>}</div>;
}

/** Campo de texto que grava ao sair do foco ou com Enter, só se mudou. */
function Field({ label, value, onCommit, list, multiline, id }: { label: string; value: string; onCommit: (v: string) => void; list?: string; multiline?: boolean; id: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => v !== value && onCommit(v);
  return (
    <label>
      {label}
      {multiline ? (
        <textarea data-testid={id} rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <input data-testid={id} list={list} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      )}
    </label>
  );
}

function NodeProps({ node, model }: { node: ArchNode; model: ArchitectureModel }) {
  const level = currentLevel({ model, path: useStore((s) => s.path) });
  const external = node.parent === level ? (projectEdges(model, level).external.get(node.id) ?? []) : [];
  const name = (id: string) => model.nodes.find((n) => n.id === id)?.name ?? id;
  const patch = (p: Record<string, unknown>) => void exec({ type: "updateNode", input: { id: node.id, ...p } });
  const children = model.nodes.filter((n) => n.parent === node.id).length;
  return (
    <>
      <Field id="prop-name" label="Nome" value={node.name} onCommit={(v) => patch({ name: v })} />
      <label>
        Tipo
        <select data-testid="prop-kind" value={node.kind} onChange={(e) => patch({ kind: e.target.value })}>
          {NODE_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <Field id="prop-tech" label="Tecnologia" list="tech-keys" value={node.tech ?? ""} onCommit={(v) => patch({ tech: v === "" ? null : v })} />
      <datalist id="tech-keys">{TECH_KEYS.map((k) => <option key={k} value={k} />)}</datalist>
      <Field id="prop-description" label="Descrição" multiline value={node.description ?? ""} onCommit={(v) => patch({ description: v === "" ? null : v })} />
      <p className="muted">id: {node.id}</p>
      {external.length > 0 && (
        <div data-testid="external-list">
          <strong>Conexões externas ({external.length})</strong>
          <ul>
            {external.map(({ edge, direction }) => (
              <li key={edge.id}>
                {direction === "in" ? "← " : "→ "}
                {name(direction === "in" ? edge.source : edge.target)}
                {edge.label ? ` (${edge.label})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="row">
        <button data-testid="enter-node" onClick={() => navigate(node.id)}>Entrar{children ? ` (${children})` : ""}</button>
        <button className="danger" data-testid="remove" onClick={() => requestRemove({ kind: "node", id: node.id })}>Remover</button>
      </div>
    </>
  );
}

function EdgeProps({ edge, model }: { edge: ArchEdge; model: ArchitectureModel }) {
  const name = (id: string) => model.nodes.find((n) => n.id === id)?.name ?? id;
  const patch = (p: Record<string, unknown>) => void exec({ type: "updateEdge", input: { id: edge.id, ...p } });
  return (
    <>
      <p>{name(edge.source)} → {name(edge.target)}</p>
      <Field id="prop-label" label="Rótulo" value={edge.label ?? ""} onCommit={(v) => patch({ label: v === "" ? null : v })} />
      <label>
        Tipo
        <select data-testid="prop-edge-kind" value={edge.kind} onChange={(e) => patch({ kind: e.target.value })}>
          {EDGE_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <button className="danger" data-testid="remove" onClick={() => requestRemove({ kind: "edge", id: edge.id })}>Remover</button>
      </div>
    </>
  );
}

export function Sidebar() {
  const model = useStore((s) => s.model)!;
  const selection = useStore((s) => s.selection);
  const node = selection?.kind === "node" ? findNode(model, selection.id) : undefined;
  const edge = selection?.kind === "edge" ? findEdge(model, selection.id) : undefined;
  return (
    <aside className="sidebar" data-testid="sidebar">
      <h2>Nós</h2>
      <Tree model={model} />
      <div className="props" data-testid="props">
        <h2 style={{ padding: "12px 0 0" }}>Propriedades</h2>
        {node && <NodeProps key={node.id} node={node} model={model} />}
        {edge && <EdgeProps key={edge.id} edge={edge} model={model} />}
        {!node && !edge && <p className="muted">Selecione um nó ou uma conexão.</p>}
      </div>
    </aside>
  );
}
