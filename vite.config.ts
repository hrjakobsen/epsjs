import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { lezer } from '@lezer/generator/rollup'

export default defineConfig({
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'epsjs',
      // the proper extensions will be added
      fileName: 'epsjs',
    },
  },
  plugins: [dts({ rollupTypes: true }), lezer()],
  esbuild: {
    target: 'es2022',
  },
})
