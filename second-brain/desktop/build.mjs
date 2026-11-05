// Compila l'app desktop:
// - dist/main.cjs            processo principale di Electron
// - dist/server.mjs          server (API + interfaccia) in un unico file
// - dist/second-brain-mcp.mjs server MCP per Claude in un unico file
import { build } from 'esbuild';

const esmBanner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" };

await Promise.all([
  build({
    entryPoints: ['src/main.ts'],
    outfile: 'dist/main.cjs',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    external: ['electron'],
    logLevel: 'info',
  }),
  build({
    entryPoints: ['../server/src/index.ts'],
    outfile: 'dist/server.mjs',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    banner: esmBanner,
    logLevel: 'info',
  }),
  build({
    entryPoints: ['../mcp/src/index.ts'],
    outfile: 'dist/second-brain-mcp.mjs',
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    banner: esmBanner,
    logLevel: 'info',
  }),
]);
