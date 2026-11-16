import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Keep Vitest's module resolution aligned with Next.js / tsconfig.json.
 * Several public preference components import through the "@/..." alias.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
