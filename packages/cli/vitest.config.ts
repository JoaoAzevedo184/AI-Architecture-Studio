import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Testes unitários usam o código-fonte dos pacotes irmãos. O teste de pacote roda à parte.
export default defineConfig({
  resolve: {
    alias: {
      "@arquitecture/core": src("../core/src/index.ts"),
      "@arquitecture/server": src("../server/src/index.ts"),
    },
  },
  test: { include: ["test/**/*.test.ts"], exclude: ["test/package.test.ts"] },
});
