import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import mapKeys from 'lodash/mapKeys'
import mapValues from 'lodash/mapValues'
import {fileURLToPath} from 'url'
import WebpackPwaManifest from 'webpack-pwa-manifest'

import baseConfig from './base'
import getAllDeployments, {PluginInDeployment} from './deployment'
import getDevServer from './dev_server'

export default async function(): Promise<webpack.Configuration[]> {
  const {dev: deployment} = await getAllDeployments()
  const devServer = await getDevServer()
  return deployment.plugins.
    map(({colors, constants, entrypoints, srcPath}: PluginInDeployment): webpack.Configuration => ({
      ...baseConfig,
      cache: true,
      devtool: 'eval-source-map',
      entry: mapValues(entrypoints, ({entry, usesHotLoader}, entrypointName): string[] => [
        ...usesHotLoader ? ['react-hot-loader/patch'] : [],
        'webpack-dev-server/client?http://0.0.0.0:0',
        ...usesHotLoader ? ['webpack/hot/only-dev-server'] : [],
        ...deployment.plugins.
          map(({loaders}: PluginInDeployment) => loaders && loaders[entrypointName]).
          filter((entry): entry is string => !!entry),
        'whatwg-fetch',
        entry,
      ]),
      mode: 'development',
      module: {
        ...baseConfig.module,
        rules: [
          ...baseConfig.module.rules,
          {
            include: [
              fileURLToPath(new URL('../src', import.meta.url)),
              fileURLToPath(new URL('../plugins', import.meta.url)),
              srcPath,
            ],
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
            enforce: 'pre',
            include: [
              fileURLToPath(new URL('/../src', import.meta.url)),
              srcPath,
            ],
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
      },
      output: {
        chunkFilename: '[name].[contenthash].js',
        filename: '[name].js',
        path: path.dirname(fileURLToPath(import.meta.url)),
        publicPath: devServer.publicPath,
      },
      plugins: [
        // TODO(pascal): Add UnusedFilesWebpackPlugin once https://github.com/tomchentw/unused-files-webpack-plugin/pull/41
        // is released. See commit 726827b653014f for latest config.
        new webpack.LoaderOptionsPlugin({
          debug: true,
        }),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.DefinePlugin({
          ...mapKeys(mapValues(colors, JSON.stringify), (color, name) => `colors.${name}`),
          ...mapKeys(mapValues(constants, JSON.stringify), (value, key) => `config.${key}`),
          'colorsMap': JSON.stringify(colors),
          'process.env.NODE_ENV': '"development"',
        }),
        // Embed the JavaScript in the index.html page.
        ...Object.entries(entrypoints).
          filter(([unusedKey, {htmlFilename}]) => htmlFilename).
          map(([key, {htmlFilename, template}]) => new HtmlWebpackPlugin({
            chunks: [key],
            filename: htmlFilename,
            template: template ? path.join(srcPath, template) :
              fileURLToPath(new URL('../src/index.tsx', import.meta.url)),
          })),
        new WebpackPwaManifest({
          // TODO(cyrille): Set-up a deployment default color.
          // eslint-disable-next-line camelcase
          background_color: colors.BOB_BLUE,
          lang: 'fr-FR',
          name: constants.productName,
          // eslint-disable-next-line camelcase
          theme_color: colors.BOB_BLUE,
        }),
        new webpack.NoEmitOnErrorsPlugin(),
      ],
      resolve: {
        ...baseConfig.resolve,
        alias: {
          ...baseConfig.resolve.alias,
          'deployment': fileURLToPath(
            new URL(`../src/deployments/${deployment.prodName}`, import.meta.url)),
          'react-dom': '@hot-loader/react-dom',
        },
      },
    }))
}
