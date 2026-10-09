import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type { Edge, NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_KINDS } from "@arquitecture/core";
import type { NodeKind } from "@arquitecture/core";
import { ArchNodeView } from "./ArchNodeView.js";
import type { ArchFlowNode } from "./ArchNodeView.js";
import { placeOnGrid } from "./lib/grid.js";
import { projectEdges } from "./lib/projection.js";
import { KIND_LABEL, connect, createNode, currentLevel, navigate, requestRemove, savePosition, select, useStore } from "./store.js";

const nodeTypes = { arch: ArchNodeView };

function Flow() {
  const model = useStore((s) => s.model)!;
  const path = useStore((s) => s.path);
  const layout = useStore((s) => s.layout);
  const selection = useStore((s) => s.selection);
  const level = currentLevel({ model, path });
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const derived = useMemo(() => {
    const kids = model.nodes.filter((n) => n.parent === level);
    const pos = placeOnGrid(kids.map((n) => n.id), layout);
    const { drawn, external } = projectEdges(model, level);
    const nodes: ArchFlowNode[] = kids.map((n) => ({
      id: n.id,
      type: "arch",
      position: pos[n.id]!,
      selected: selection?.kind === "node" && selection.id === n.id,
      data: {
        node: n,
        childCount: model.nodes.filter((c) => c.parent === n.id).length,
        externalCount: external.get(n.id)?.length ?? 0,
      },
    }));
    const edges: Edge[] = drawn.map((d) => ({
      id: d.id,
      source: d.source,
      target: d.target,
      label: d.label,
      selected: selection?.kind === "edge" && selection.id === d.id,
      animated: d.kind === "async",
      style: d.kind === "data" || d.aggregated ? { strokeDasharray: "6 4" } : undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { testid: `edge-${d.id}` },
    }));
    return { nodes, edges };
  }, [model, level, layout, selection]);

  const [nodes, setNodes, onNodesChange] = useNodesState<ArchFlowNode>(derived.nodes);
  // Preserva as medidas dos nós já montados; recriá-los a cada seleção perderia o duplo clique.
  useEffect(
    () => setNodes((prev) => derived.nodes.map((d) => ({ ...(prev.find((p) => p.id === d.id) ?? {}), ...d }))),
    [derived.nodes, setNodes],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_e, n) => navigate(n.id), []);

  return (
    <div className="canvas" data-testid="canvas" onClick={() => setMenu(null)}>
      <ReactFlow
        nodes={nodes}
        edges={derived.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        colorMode="dark"
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        onNodeClick={(_e, n) => select({ kind: "node", id: n.id })}
        onEdgeClick={(_e, ed) => select({ kind: "edge", id: ed.id })}
        onPaneClick={() => select(null)}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={(_e, n) => void savePosition(n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) })}
        onConnect={(c) => void connect(c.source, c.target)}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        onKeyDown={(e) => {
          const sel = useStore.getState().selection;
          if ((e.key === "Delete" || e.key === "Backspace") && sel && !(e.target as HTMLElement).closest("input,textarea,select")) {
            requestRemove(sel);
          }
        }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} data-testid="context-menu">
          {NODE_KINDS.map((k: NodeKind) => (
            <button
              key={k}
              data-testid={`ctx-add-${k}`}
              onClick={() => void createNode(k, screenToFlowPosition({ x: menu.x, y: menu.y }))}
            >
              Novo {KIND_LABEL[k].toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
