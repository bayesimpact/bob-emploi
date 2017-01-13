var path = require('path')
var webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var _ = require('lodash')

var baseConfig = require('./base')

// Add needed plugins here.
var BowerWebpackPlugin = require('bower-webpack-plugin')

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
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    // Fetch polyfill.
    new webpack.ProvidePlugin({
      'fetch': 'imports?this=>global!exports?global.fetch!whatwg-fetch',
    }),
    // Embed the JavaScript in the index.html page.
    new HtmlWebpackPlugin({
      template: path.join(__dirname, '/../src/index.html'),
    }),
    new webpack.NoErrorsPlugin(),
    new BowerWebpackPlugin({
      searchResolveModulesDirectories: false,
    }),
  ],
}, baseConfig)

// Add needed loaders.
config.module.loaders.push({
  include: [
    path.join(__dirname, '/../src'),
  ],
  loader: 'react-hot!babel-loader',
  test: /\.(js|jsx)$/,
})

module.exports = config
