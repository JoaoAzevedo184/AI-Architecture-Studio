import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// O núcleo é consumido pelo código-fonte, sem exigir build prévio.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@arquitecture/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
  server: {
    // Em desenvolvimento, /api vai para o servidor local.
    proxy: { "/api": "http://127.0.0.1:4517" },
  },
  test: { include: ["test/**/*.test.ts"] },
});
