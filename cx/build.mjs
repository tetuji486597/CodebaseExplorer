import { build } from 'esbuild';

await build({
  entryPoints: ['bin/cx.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/cli.mjs',
  banner: {
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'module';
const require = __createRequire(import.meta.url);
`,
  },
  external: ['dotenv'],
  alias: {
    'react-devtools-core': './shims/empty.js',
  },
  minify: false,
  sourcemap: false,
  jsx: 'automatic',
  jsxImportSource: 'react',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
});

console.log('Built dist/cli.mjs');
