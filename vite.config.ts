import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ["cubing"] },
  worker: { format: "es" },
  build: {
    cssCodeSplit: false,
    modulePreload: {
      polyfill: false,
      resolveDependencies(_filename, dependencies, { hostId }) {
        const cubingWorkerModule = [
          "search-worker-entry",
          "inside-",
          "search-dynamic-",
          "puzzles-dynamic-",
          "twips-",
          "twips_wasm_",
        ].some((part) => hostId.indexOf(part) !== -1);
        return cubingWorkerModule ? [] : dependencies;
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
  },
});
