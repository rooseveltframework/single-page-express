import { fileURLToPath } from 'url'
import path from 'path'
import TerserPlugin from 'terser-webpack-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default [
  // esm
  {
    name: 'main',
    entry: './single-page-express.js',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'single-page-express.mjs',
      library: {
        type: 'module'
      },
      globalObject: 'this',
      umdNamedDefine: true
    },
    experiments: {
      outputModule: true
    },
    mode: 'development',
    devtool: 'source-map',
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            compress: {
              defaults: false,
              unused: true
            },
            mangle: false,
            format: {
              comments: 'all'
            }
          }
        })
      ]
    }
  },

  // commonjs
  {
    name: 'main',
    entry: './single-page-express.js',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'single-page-express.cjs',
      library: 'singlePageExpress',
      libraryTarget: 'umd',
      globalObject: 'this',
      umdNamedDefine: true
    },
    mode: 'development',
    devtool: 'source-map',
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            compress: {
              defaults: false,
              unused: true
            },
            mangle: false,
            format: {
              comments: 'all'
            }
          }
        })
      ]
    }
  },

  // standalone (directly includable in a <script> tag)
  {
    name: 'main',
    entry: './single-page-express.js',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'single-page-express.js',
      library: 'singlePageExpress',
      libraryTarget: 'umd',
      globalObject: 'this',
      umdNamedDefine: true
    },
    mode: 'production',
    devtool: 'source-map',
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            compress: {
              defaults: false,
              unused: true
            },
            mangle: false,
            format: {
              comments: 'all'
            }
          }
        })
      ]
    }
  },

  // esm minified
  {
    name: 'main',
    entry: './single-page-express.js',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'single-page-express.min.mjs',
      library: {
        type: 'module'
      }
    },
    experiments: {
      outputModule: true
    },
    mode: 'production',
    devtool: 'source-map',
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            compress: {
              defaults: true,
              unused: true
            },
            mangle: true,
            format: {
              comments: false
            }
          }
        })
      ]
    }
  },

  // standalone (directly includable in a <script> tag) minified
  {
    name: 'main',
    entry: './single-page-express.js',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'single-page-express.min.js',
      library: 'singlePageExpress',
      libraryTarget: 'umd',
      globalObject: 'this',
      umdNamedDefine: true
    },
    mode: 'production',
    devtool: 'source-map',
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            compress: {
              defaults: true,
              unused: true
            },
            mangle: true,
            format: {
              comments: false
            }
          }
        })
      ]
    }
  }
]
