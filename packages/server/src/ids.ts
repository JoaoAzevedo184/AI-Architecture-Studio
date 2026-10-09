import { randomBytes } from "node:crypto";
import type { IdGenerator } from "@arquitecture/core";

const ALFABETO = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Gerador real: prefixo `n_`/`e_` e sufixo aleatório curto. */
export const randomIdGenerator: IdGenerator = (entity) => {
  const bytes = randomBytes(6);
  let sufixo = "";
  for (const b of bytes) sufixo += ALFABETO[b % ALFABETO.length];
  return (entity === "node" ? "n_" : "e_") + sufixo;
};

const MAX_TENTATIVAS = 100;

/** Repete o gerador base enquanto o id já existir. Após o limite devolve o último e o núcleo recusa com DUPLICATE_ID. */
export function uniqueIds(base: IdGenerator, taken: { nodes: Set<string>; edges: Set<string> }): IdGenerator {
  return (entity) => {
    const used = entity === "node" ? taken.nodes : taken.edges;
    let id = base(entity);
    for (let i = 1; i < MAX_TENTATIVAS && used.has(id); i++) id = base(entity);
    used.add(id);
    return id;
  };
}
