// Vercel compiles TypeScript file by file, which breaks extensionless imports and the
// workspace package. Bundle the function into one file instead. The libSQL native
// bindings cannot be bundled, so they stay external and are traced by Vercel.
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

// The project needs a static output directory even though every request goes to the function.
mkdirSync('public', { recursive: true });
writeFileSync('public/robots.txt', 'User-agent: *\nDisallow: /\n');

await build({
  entryPoints: ['src/vercel.ts'],
  outfile: 'api/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['libsql', '@libsql/*'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
