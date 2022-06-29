import path from 'path'
import webpack from 'webpack'
import TerserPlugin from 'terser-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import WebpackPwaManifest from 'webpack-pwa-manifest'
import _mapKeys from 'lodash/mapKeys'
import _mapValues from 'lodash/mapValues'
import {fileURLToPath} from 'url'

import baseConfig, {createCSSRule, makeDefinitionFallback} from './base'
import {getDistDeployments} from './deployment'

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

const coreSrcPath = fileURLToPath(new URL('../src', import.meta.url))

// TODO(cyrille): Test the output.
export default async function(): Promise<readonly webpack.Configuration[]> {
  const keptDeployments = await getDistDeployments(process.env.BOB_DEPLOYMENTS)

  const maxNameLength = Math.max(
    ...keptDeployments.flatMap(({name, plugins}) => plugins.map(({name: pluginName}) =>
      `${name}-${pluginName}`.length)))
  const rightPad = (name: string): string => name + ' '.repeat(maxNameLength - name.length)

  return keptDeployments.flatMap(({name, plugins, prodName}) =>
    plugins.map(({
      constants: {colors, config: constants}, entrypoints, isCore, name: pluginName, srcPath,
    }): webpack.Configuration => ({
      ...baseConfig,
      bail: true,
      cache: false,
      devtool: 'source-map',
      entry: _mapValues(entrypoints, ({entry}, entrypointName) => [
        'whatwg-fetch',
        ...plugins.map(({loaders}) => loaders && loaders[entrypointName]).
          filter((entry): entry is string => !!entry),
        entry,
      ]),
      mode: 'production',
      module: {
        ...baseConfig.module,
        rules: [
          ...baseConfig.module.rules,
          {oneOf: [
            {
              generator: {
                filename: 'favicon.ico',
                outputPath: '..',
                publicPath: '/',
              },
              resource: path.join(coreSrcPath, 'deployments', prodName, 'favicon.ico'),
              type: 'asset/resource',
            },
            ...isCore ? [] : [{
              generator: {
                filename: 'favicon.ico',
                outputPath: path.join('..', pluginName),
                publicPath: '/',
              },
              resource: path.join(srcPath, 'deployments', prodName, 'favicon.ico'),
              type: 'asset/resource',
            }],
            {
              loader: 'null-loader',
              test: /favicon\.ico$/,
            },
          ]},
          createCSSRule(colors),
          {oneOf: [
            // Explicitly import as static, to make sure we don't do it in the main build.
            // This should be used only in the HtmlWebpackPlugin templates.
            {
              include: [
                coreSrcPath,
                fileURLToPath(new URL('../plugins', import.meta.url)),
                srcPath,
              ],
              resourceQuery: /static/,
              test: /\.[jt]sx?$/,
              use: {
                loader: 'babel-loader',
                options: {cacheDirectory: true},
              },
            },
            // Forbid importing static_i18n.ts
            {
              exclude: [
                fileURLToPath(new URL('../src/store/static_i18n.ts', import.meta.url)),
              ],
              include: [
                fileURLToPath(new URL('../src', import.meta.url)),
                fileURLToPath(new URL('../plugins', import.meta.url)),
                srcPath,
              ],
              test: /\.[jt]sx?$/,
              use: {
                loader: 'babel-loader',
                options: {cacheDirectory: true},
              },
            },
          ]},
        ],
      },
      name: `${name}-${pluginName}`,
      optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
      },
      output: {
        chunkFilename: '[name].[contenthash].js',
        filename: ({chunk: {name: chunkName = ''} = {}}) =>
          entrypoints[chunkName] && entrypoints[chunkName].htmlFilename ?
            '[name].[contenthash].js' : '[name].js',
        // TODO(cyrille): Consider outputing to plugin subfolder.
        path: fileURLToPath(new URL(`../dist/${name}/assets`, import.meta.url)),
        publicPath: '/assets/',
      },
      plugins: [
        new webpack.ProgressPlugin((percentage, message, ...args) => {
          // eslint-disable-next-line no-console
          console.info(
            '[webpack.Progress]',
            rightPad(`${name}-${pluginName}`),
            `${Math.round(percentage * 100)}%`,
            message,
            ...args)
        }),
        // Define free variables -> global constants.
        new webpack.DefinePlugin({
          ..._mapKeys(_mapValues(colors, JSON.stringify), (color, name) => `colors.${name}`),
          ..._mapKeys(_mapValues(constants, JSON.stringify), (value, key) => `config.${key}`),
          'colors': makeDefinitionFallback(colors, 'colors', `${name}-${pluginName}`),
          'colorsMap': JSON.stringify(colors),
          'config': makeDefinitionFallback(constants, 'config', `${name}-${pluginName}`),
          'process.env.NODE_ENV': '"production"',
        }),
        new webpack.LoaderOptionsPlugin({
          debug: false,
          minimize: true,
        }),
        // Embed the JavaScript in the index.html page.
        ...Object.entries(entrypoints).
          filter(([unusedKey, {htmlFilename}]) => htmlFilename).
          map(([key, {htmlFilename, template}]) => new HtmlWebpackPlugin({
            chunks: [key],
            filename: `../${htmlFilename}`,
            minify,
            template: template ? path.join(srcPath, template) :
              fileURLToPath(new URL('../src/index.tsx', import.meta.url)),
          })),
        new WebpackPwaManifest({
          // eslint-disable-next-line camelcase
          background_color: colors.BOB_BLUE,
          lang: 'fr-FR',
          name: constants.productName || 'Bob',
          // eslint-disable-next-line camelcase
          theme_color: colors.BOB_BLUE,
        }),
      ],
      resolve: {
        ...baseConfig.resolve,
        alias: {
          ...baseConfig.resolve.alias,
          'deployment': fileURLToPath(new URL(`../src/deployments/${prodName}`, import.meta.url)),
          'plugin/deployment': [
            path.join(srcPath, 'deployments', prodName),
            path.join(srcPath, 'deployments', 'default'),
          ],
        },
      },
    })),
  )
}
