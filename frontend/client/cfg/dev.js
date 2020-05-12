const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const mapKeys = require('lodash/mapKeys')
const mapValues = require('lodash/mapValues')
const WebpackPwaManifest = require('webpack-pwa-manifest')

const baseConfigs = require('./base')
const devServer = require('./dev_server')
const plugins = require('./plugins')

module.exports = plugins.map(({colors, constants, entrypoints, srcPath}, index) => {
  const baseConfig = baseConfigs[index]
  return {
    ...baseConfig,
    cache: true,
    devtool: 'eval-source-map',
    entry: mapValues(entrypoints, ({entry, usesHotLoader}) => ([
      ...usesHotLoader ? ['react-hot-loader/patch'] : [],
      'webpack-dev-server/client?http://0.0.0.0:0',
      ...usesHotLoader ? ['webpack/hot/only-dev-server'] : [],
      'whatwg-fetch',
      entry,
    ])),
    mode: 'development',
    module: {
      ...baseConfig.module,
      rules: [
        ...baseConfig.module.rules,
        {
          include: [
            path.join(__dirname, '/../release'),
            path.join(__dirname, '/../src'),
            srcPath,
          ],
          test: /\.[jt]sx?$/,
          use: {
            loader: 'babel-loader',
            options: {
              plugins: [
                'react-hot-loader/babel',
                '@babel/plugin-syntax-dynamic-import',
                ['@babel/plugin-proposal-class-properties', {loose: false}],
                ['@babel/plugin-proposal-optional-chaining', {loose: false}],
              ],
              presets: [['@babel/env', {modules: false}], '@babel/react', '@babel/typescript'],
            },
          },
        },
        {
          enforce: 'pre',
          include: [
            path.join(__dirname, '/../src'),
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
    output: {
      filename: '[name].js',
      path: __dirname,
      publicPath: devServer.publicPath,
    },
    plugins: [
      ...baseConfig.plugins,
      new webpack.LoaderOptionsPlugin({
        debug: true,
      }),
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NamedModulesPlugin(),
      new webpack.DefinePlugin({
        ...mapKeys(mapValues(colors, JSON.stringify), (color, name) => `colors.${name}`),
        ...mapKeys(mapValues(constants, JSON.stringify), (value, key) => `config.${key}`),
        'config.clientVersion': JSON.stringify(process.env.CLIENT_VERSION),
      }),
      // Embed the JavaScript in the index.html page.
      ...Object.keys(entrypoints).filter(key => entrypoints[key].htmlFilename).map(key =>
        new HtmlWebpackPlugin({
          chunks: [key],
          filename: `${entrypoints[key].htmlFilename}`,
          template: './src/index.tsx',
        }),
      ),
      new WebpackPwaManifest({
        // eslint-disable-next-line camelcase
        background_color: '#1888ff', // Colors.BOB_BLUE
        lang: 'fr-FR',
        name: 'Bob',
        // eslint-disable-next-line camelcase
        theme_color: '#1888ff', // Colors.BOB_BLUE
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
})
