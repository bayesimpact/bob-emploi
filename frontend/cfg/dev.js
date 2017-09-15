const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const _ = require('lodash')
const WebpackPwaManifest = require('webpack-pwa-manifest')

const baseConfig = require('./base')

const config = _.merge({
  cache: true,
  devtool: 'eval-source-map',
  entry: {
    app: [
      'react-hot-loader/patch',
      'webpack-dev-server/client?http://0.0.0.0:0',
      'webpack/hot/only-dev-server',
      './src/entry',
    ],
    eval: [
      'react-hot-loader/patch',
      'webpack-dev-server/client?http://0.0.0.0:0',
      'webpack/hot/only-dev-server',
      './src/eval_entry',
    ],
    unsubscribe: [
      'webpack-dev-server/client?http://0.0.0.0:0',
      './src/components/pages/unsubscribe',
    ],
  },
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
  new HtmlWebpackPlugin({
    chunks: ['app'],
    template: './src/index.html',
  }),
  new HtmlWebpackPlugin({
    chunks: ['eval'],
    filename: 'eval.html',
    template: './src/index.html',
  }),
  new HtmlWebpackPlugin({
    chunks: ['unsubscribe'],
    filename: 'unsubscribe.html',
    template: './src/index.html',
  }),
  new WebpackPwaManifest({
    lang: 'fr-FR',
    name: 'Bob Emploi',
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
      presets: [['es2015', {modules: false}], 'react', 'stage-0'],
    },
  },
})

module.exports = config
