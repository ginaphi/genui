import esbuild from 'esbuild'

const isWatch = process.argv.includes('--watch')
const isProd = process.argv.includes('--production')

const options = {
  entryPoints: ['src/extension/index.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: !isProd,
  minify: isProd,
  logLevel: 'info',
}

if (isWatch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  console.log('esbuild: watching extension host')
} else {
  await esbuild.build(options)
}
