import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin'
import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import mapKeys from 'lodash/mapKeys'
import mapValues from 'lodash/mapValues'
import {fileURLToPath} from 'url'
import WebpackPwaManifest from 'webpack-pwa-manifest'

import baseConfig, {createCSSRule, makeDefinitionFallback} from './base'
import type {PluginInDeployment} from './deployment'
import getAllDeployments from './deployment'

const babelPlugins = [
  '@babel/plugin-syntax-dynamic-import',
  ['@babel/plugin-proposal-class-properties', {loose: false}],
  ['@babel/plugin-proposal-optional-chaining', {loose: false}],
] as const
const babelPresets = [
  ['@babel/env', {corejs: 3, modules: false, useBuiltIns: 'usage'}],
  '@babel/react',
  '@babel/typescript',
] as const

export default async function(): Promise<readonly webpack.Configuration[]> {
  const {dev: deployment} = await getAllDeployments()
  return deployment.plugins.
    map((plugin: PluginInDeployment) => {
      const {constants: {colors, config: constants}, entrypoints, name, srcPath} = plugin
      return {
        ...baseConfig,
        cache: true,
        devtool: 'eval-source-map',
        entry: mapValues(entrypoints, ({entry}, entrypointName): string[] => [
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
              oneOf: [
                // Modules without React Fast Refresh: add all modules that are required for
                // Server Side Rendering here.
                // See https://github.com/pmmmwh/react-refresh-webpack-plugin/blob/main/docs/TROUBLESHOOTING.md#usage-with-indirection-like-workers-and-js-templates
                {
                  include: [
                    fileURLToPath(new URL('../src/index.tsx', import.meta.url)),
                    fileURLToPath(new URL('../src/components/pages/waiting.tsx', import.meta.url)),
                    /.*loading_image.tsx$/,
                    ...Object.values(entrypoints).
                      flatMap(({htmlFilename, template, templateDependencies}) =>
                        htmlFilename && template ? [
                          template,
                          ...templateDependencies || [],
                        ].map(dep => path.join(srcPath, dep)) : []),
                  ],
                  test: /\.[jt]sx?$/,
                  use: {
                    loader: 'babel-loader',
                    // Override default options from .babelrc.
                    options: {
                      plugins: babelPlugins,
                      presets: babelPresets,
                    },
                  },
                },
                // Other modules.
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
                      plugins: ['react-refresh/babel', ...babelPlugins],
                      presets: babelPresets,
                    },
                  },
                },
              ],
              test: /\.[jt]sx?$/,
            },
            createCSSRule(colors),
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
          publicPath: '/',
        },
        plugins: [
          // TODO(pascal): Add UnusedFilesWebpackPlugin once https://github.com/tomchentw/unused-files-webpack-plugin/pull/41
          // is released. See commit 726827b653014f for latest config.
          new webpack.LoaderOptionsPlugin({
            debug: true,
          }),
          new ReactRefreshWebpackPlugin(),
          new webpack.DefinePlugin({
            ...mapKeys(mapValues(colors, JSON.stringify), (color, name) => `colors.${name}`),
            ...mapKeys(mapValues(constants, JSON.stringify), (value, key) => `config.${key}`),
            'colors': makeDefinitionFallback(colors, 'colors', `${deployment.name}-${name}`),
            'colorsMap': JSON.stringify(colors),
            'config': makeDefinitionFallback(constants, 'config', `${deployment.name}-${name}`),
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
            name: constants.productName || 'Bob',
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
            'plugin/deployment': [
              path.join(srcPath, 'deployments', deployment.prodName),
              path.join(srcPath, 'deployments', 'default'),
            ],
          },
        },
      }
    })
}
