var path = require('path')
var webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var _ = require('lodash')

var baseConfig = require('./base')

var config = _.merge({
  cache: false,
  devtool: 'hidden-source-map',
  entry: [
    'babel-polyfill',
    path.join(__dirname, '../src/components/pages/main'),
  ],
  output: {
    filename: 'app.[hash].js',
    path: path.join(__dirname, '/../dist/assets'),
    publicPath: '/assets/',
  },
}, baseConfig)

Array.prototype.push.apply(config.plugins, [
  // Define free variables -> global constants.
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': '"production"',
  }),
  // Minimize all JavaScript files to reduce their size (renames variable names, etc).
  new webpack.optimize.UglifyJsPlugin({sourceMap: true}),
  // Only keep the fr locale from the moment library.
  new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, /fr/),
  // Embed the JavaScript in the index.html page.
  new HtmlWebpackPlugin({
    filename: '../index.html',
    minify: {
      collapseWhitespace: true,
      decodeEntities: true,
      minifyCSS: true,
      removeAttributeQuotes: true,
      removeComments: true,
      removeOptionalTags: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
    },
    template: path.join(__dirname, '/../src/index.html'),
  }),
  // When there are errors while compiling this plugin skips the emitting phase,
  // so there are no assets emitted that include errors.
  new webpack.NoEmitOnErrorsPlugin(),
])

config.module.rules.push({
  include: [
    path.join(__dirname, '/../src'),
  ],
  test: /\.(js|jsx)$/,
  use: 'babel-loader',
})

module.exports = config
