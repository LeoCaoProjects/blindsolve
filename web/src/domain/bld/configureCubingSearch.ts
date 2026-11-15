import { setSearchDebug } from "cubing/search";

/**
 * cubing.js ships a Vite/esbuild-compatible worker loader alongside its
 * import.meta.resolve loader. Prefer that supported path so Vite can rewrite
 * the search worker to the hashed asset emitted by a production build.
 *
 * Keep this explicit: a cubing.js upgrade that removes or renames the option
 * should fail TypeScript/build checks instead of silently regressing workers.
 */
export function configureCubingSearchWorker() {
  setSearchDebug({
    prioritizeEsbuildWorkaroundForWorkerInstantiation: true,
  });
}
