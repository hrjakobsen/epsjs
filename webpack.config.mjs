import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
const rootDir = dirname(fileURLToPath(import.meta.url))

export default {
  entry: {
    epsjs: {
      import: './src/index.ts',
      library: {
        type: 'module',
      },
    },
    dev: { import: './dev/index.ts' },
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
    static: {
      directory: join(rootDir, 'dev'),
    },
    compress: true,
    port: 9000,
  },
}