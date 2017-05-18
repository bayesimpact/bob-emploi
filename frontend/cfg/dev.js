const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const _ = require('lodash')

const baseConfig = require('./base')

const config = _.merge({
  cache: true,
  devtool: 'eval-source-map',
  entry: [
    'react-hot-loader/patch',
    'webpack-dev-server/client?http://0.0.0.0:0',
    'webpack/hot/only-dev-server',
    './src/entry',
  ],
  output: {
    filename: 'app.js',
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
    template: path.join(__dirname, '/../src/index.html'),
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
