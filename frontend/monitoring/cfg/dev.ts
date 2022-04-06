import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import {fileURLToPath} from 'url'

import baseConfig from './base'

export default {
  ...baseConfig,
  cache: true,
  devtool: 'eval-source-map',
  entry: [
    'react-hot-loader/patch',
    ...baseConfig.entry,
  ],
  mode: 'development' as const,
  module: {
    ...baseConfig.module,
    rules: [
      ...baseConfig.module.rules,
      {
        include: [fileURLToPath(new URL('../src', import.meta.url))],
        test: /\.[jt]sx?$/,
        use: {
          loader: 'babel-loader',
          // Override default options from .babelrc.
          options: {
            plugins: [
              'react-hot-loader/babel',
              '@babel/plugin-syntax-dynamic-import',
              ['@babel/plugin-proposal-class-properties', {loose: false}],
              ['@babel/plugin-proposal-optional-chaining', {loose: false}],
            ],
            presets: [
              ['@babel/env', {corejs: 3, modules: false, useBuiltIns: 'usage'}],
              '@babel/react',
              '@babel/typescript',
            ],
          },
        },
      },
      {
        enforce: 'pre' as const,
        include: [fileURLToPath(new URL('/../src', import.meta.url))],
        test: /\.(js|jsx)$/,
        use: {
          loader: 'eslint-loader',
          options: {emitWarning: true},
        },
      },
    ],
  },
  optimization: {
    chunkIds: 'named',
    moduleIds: 'named',
  } as const,
  output: {
    chunkFilename: '[name].[contenthash].js',
    filename: '[name].js',
    path: path.dirname(fileURLToPath(import.meta.url)),
    publicPath: '/',
  },
  plugins: [
    // TODO(pascal): Add UnusedFilesWebpackPlugin once https://github.com/tomchentw/unused-files-webpack-plugin/pull/41
    // is released. See commit 726827b653014f for latest config.
    new webpack.LoaderOptionsPlugin({
      debug: true,
    }),
    new webpack.HotModuleReplacementPlugin(),
    // Embed the JavaScript in the index.html page.
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: fileURLToPath(new URL('../src/index.tsx', import.meta.url)),
    }),
    new webpack.NoEmitOnErrorsPlugin(),
  ],
  resolve: {
    ...baseConfig.resolve,
    alias: {
      ...baseConfig.resolve.alias,
      'react-dom': '@hot-loader/react-dom',
    },
  },
}
