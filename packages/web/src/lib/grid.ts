import type { Position } from "@arquitecture/core";

export const NODE_W = 200;
export const NODE_H = 96;
const GAP = 40;
const COLS = 4;

const overlaps = (a: Position, b: Position) => Math.abs(a.x - b.x) < NODE_W + 16 && Math.abs(a.y - b.y) < NODE_H + 16;

/** Posições de todos os `ids`: as salvas são mantidas; as ausentes entram em grade sem sobrepor nenhuma. */
export function placeOnGrid(ids: string[], saved: Record<string, Position>): Record<string, Position> {
  const out: Record<string, Position> = {};
  const occupied: Position[] = [];
  for (const id of ids) {
    const p = saved[id];
    if (p) {
      out[id] = p;
      occupied.push(p);
    }
  }
  let cell = 0;
  for (const id of ids) {
    if (out[id]) continue;
    for (;; cell++) {
      const p = { x: (cell % COLS) * (NODE_W + GAP), y: Math.floor(cell / COLS) * (NODE_H + GAP) };
      if (!occupied.some((o) => overlaps(o, p))) {
        out[id] = p;
        occupied.push(p);
        break;
      }
    }
  }
  return out;
}
