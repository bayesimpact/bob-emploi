const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const mapValues = require('lodash/mapValues')
const merge = require('lodash/merge')
const WebpackPwaManifest = require('webpack-pwa-manifest')

const baseConfig = require('./base')
const entrypoints = require('./entrypoints')

const config = merge({
  cache: true,
  devtool: 'eval-source-map',
  entry: mapValues(entrypoints, ({entry, usesHotLoader}) => ([
    ...usesHotLoader ? ['react-hot-loader/patch'] : [],
    'webpack-dev-server/client?http://0.0.0.0:0',
    ...usesHotLoader ? ['webpack/hot/only-dev-server'] : [],
    entry,
  ])),
  mode: 'development',
  output: {
    filename: '[name].js',
    path: __dirname,
    publicPath: baseConfig.devServer.publicPath,
  },
}, baseConfig)

Array.prototype.push.apply(config.plugins, [
  new webpack.LoaderOptionsPlugin({
    debug: true,
  }),
  new webpack.HotModuleReplacementPlugin(),
  new webpack.NamedModulesPlugin(),
  // Embed the JavaScript in the index.html page.
  ...Object.keys(entrypoints).filter(key => entrypoints[key].htmlFilename).map(key =>
    new HtmlWebpackPlugin({
      chunks: [key],
      filename: `${entrypoints[key].htmlFilename}`,
      template: './src/index.html',
    })
  ),
  new WebpackPwaManifest({
    lang: 'fr-FR',
    name: 'Bob',
  }),
  new webpack.NoEmitOnErrorsPlugin(),
])

// Add needed rules.
config.module.rules.push({
  include: [
    path.join(__dirname, '/../src'),
  ],
  test: /\.(js|jsx)$/,
  use: {
    loader: 'babel-loader',
    options: {
      plugins: ['react-hot-loader/babel'],
      presets: [['env', {modules: false}], 'react', 'stage-0'],
    },
  },
})
config.module.rules.push({
  enforce: 'pre',
  include: [
    path.join(__dirname, '/../src'),
  ],
  test: /\.(js|jsx)$/,
  use: {
    loader: 'eslint-loader',
    options: {emitWarning: true},
  },
})

module.exports = config
