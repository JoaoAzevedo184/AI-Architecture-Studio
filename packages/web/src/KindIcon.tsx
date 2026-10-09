import type { NodeKind } from "@arquitecture/core";

// Ícones simples por kind (traço, herdam a cor via currentColor).
const PATHS: Record<NodeKind, string> = {
  external: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  proxy: "M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4",
  group: "M3 3h18v18H3zM8 8h8v8H8z",
  service: "M12 3l8 4.5v9L12 21l-8-4.5v-9z",
  frontend: "M3 5h18v14H3zM3 9h18",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  cache: "M13 2L4 14h7l-1 8 9-12h-7z",
  queue: "M3 6h14M3 12h14M3 18h14M19 9l3 3-3 3",
  storage: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
};

export function KindIcon({ kind }: { kind: NodeKind }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <path d={PATHS[kind]} />
    </svg>
  );
}
