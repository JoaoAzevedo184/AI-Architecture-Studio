import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { ArchNode } from "@arquitecture/core";
import { KindIcon } from "./KindIcon.js";
import { resolveIcon } from "./lib/icons.js";

export interface NodeData extends Record<string, unknown> {
  node: ArchNode;
  childCount: number;
  externalCount: number;
}
export type ArchFlowNode = Node<NodeData, "arch">;

export function ArchNodeView({ data, selected }: NodeProps<ArchFlowNode>) {
  const { node, childCount, externalCount } = data;
  const icon = resolveIcon(node.tech, node.kind);
  return (
    <div
      className={"arch-node" + (selected ? " selected" : "")}
      style={{ "--c": `var(--kind-${node.kind})` } as React.CSSProperties}
      data-testid={`node-${node.id}`}
      data-name={node.name}
    >
      <Handle type="target" position={Position.Left} />
      <div className="arch-icon">
        {icon.type === "tech" ? <img src={icon.url} alt={node.tech} draggable={false} /> : <KindIcon kind={icon.kind} />}
      </div>
      <div className="arch-text">
        <div className="arch-name">{node.name}</div>
        <div className="arch-detail">{node.tech ?? node.kind}</div>
      </div>
      {childCount > 0 && (
        <span className="badge children" title="Filhos diretos" data-testid="children-count">
          {childCount}
        </span>
      )}
      {externalCount > 0 && (
        <span className="badge external" title="Conexões com nós fora deste nível" data-testid="external-count">
          ↗ {externalCount}
        </span>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
