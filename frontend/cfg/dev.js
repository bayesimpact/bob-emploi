var path = require('path')
var webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var _ = require('lodash')

var baseConfig = require('./base')

var config = _.merge({
  cache: true,
  devtool: 'eval-source-map',
  entry: [
    'webpack-dev-server/client?http://0.0.0.0:0',
    'webpack/hot/only-dev-server',
    './src/components/pages/main',
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
  use: ['react-hot-loader', 'babel-loader'],
})

module.exports = config
