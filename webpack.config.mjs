import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
const rootDir = dirname(fileURLToPath(import.meta.url))

export default (_, argv) => ({
  entry: {
    epsjs: {
      import: './src/index.ts',
      library: {
        type: 'module',
      },
    },
    ...(argv.mode === 'development'
      ? { dev: { import: './dev/index.ts' } }
      : {}),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    path: resolve(rootDir, 'dist'),
  },
  devServer: {
    static: [join(rootDir, 'dev'), join(rootDir, 'examples')],
    compress: true,
    port: 9000,
  },
})
