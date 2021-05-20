import path from 'path'
import webpack from 'webpack'
import TerserPlugin from 'terser-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import WebpackPwaManifest from 'webpack-pwa-manifest'
import _flatMap from 'lodash/flatMap'
import _mapKeys from 'lodash/mapKeys'
import _mapValues from 'lodash/mapValues'
import _uniqBy from 'lodash/uniqBy'
import {fileURLToPath} from 'url'

import baseConfig from './base'
import getAllDeployments from './deployment'

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

export default async function(): Promise<webpack.Configuration[]> {
  const allDeployments = await getAllDeployments()

  const deploymentsRegexp = new RegExp(process.env.BOB_DEPLOYMENTS || '.*')
  const keptDeployments = _uniqBy(
    Object.keys(allDeployments).
      filter(name => name !== 'test' &&
        !name.toLowerCase().endsWith('dev') &&
        deploymentsRegexp.test(name)).
      map(name => allDeployments[name]),
    'name')

  const maxNameLength = Math.max(
    ...keptDeployments.flatMap(({name, plugins}) => plugins.map(({name: pluginName}) =>
      `${name}-${pluginName}`.length)))
  const rightPad = (name: string): string => name + ' '.repeat(maxNameLength - name.length)

  return _flatMap(keptDeployments, ({name, plugins, prodName}) =>
    plugins.map(({
      colors, constants, entrypoints, name: pluginName, srcPath,
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
          {
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
          'colorsMap': JSON.stringify(colors),
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
          name: constants.productName,
          // eslint-disable-next-line camelcase
          theme_color: colors.BOB_BLUE,
        }),
      ],
      resolve: {
        ...baseConfig.resolve,
        alias: {
          ...baseConfig.resolve.alias,
          deployment: fileURLToPath(new URL(`../src/deployments/${prodName}`, import.meta.url)),
        },
      },
    })),
  )
}
