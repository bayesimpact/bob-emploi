import webpack from 'webpack'
import TerserPlugin from 'terser-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import {fileURLToPath} from 'url'

import baseConfig from './base'

const minify = {
  collapseWhitespace: true,
  decodeEntities: true,
  minifyCSS: true,
  removeAttributeQuotes: true,
  removeComments: true,
  removeOptionalTags: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
}

export default {
  ...baseConfig,
  bail: true,
  cache: false,
  devtool: 'source-map',
  mode: 'production' as const,
  module: {
    ...baseConfig.module,
    rules: [
      ...baseConfig.module.rules,
      {
        include: [fileURLToPath(new URL('../src', import.meta.url))],
        test: /\.[jt]sx?$/,
        use: {
          loader: 'babel-loader',
          options: {cacheDirectory: true},
        },
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  output: {
    chunkFilename: '[name].[contenthash].js',
    filename: '[name].[contenthash].js',
    path: fileURLToPath(new URL('../dist/assets', import.meta.url)),
    publicPath: 'assets/',
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new webpack.LoaderOptionsPlugin({
      debug: false,
      minimize: true,
    }),
    // Embed the JavaScript in the index.html page.
    new HtmlWebpackPlugin({
      filename: '../index.html',
      minify,
      template: fileURLToPath(new URL('../src/index.tsx', import.meta.url)),
    }),
  ],
}
