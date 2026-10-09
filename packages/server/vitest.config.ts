import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Os testes usam o código-fonte do núcleo, sem exigir build prévio.
export default defineConfig({
  resolve: {
    alias: { "@arquitecture/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
});
