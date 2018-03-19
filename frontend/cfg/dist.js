const path = require('path')
const webpack = require('webpack')
const RenameOutputWebpackPlugin = require('rename-output-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const WebpackPwaManifest = require('webpack-pwa-manifest')
const fromPairs = require('lodash/fromPairs')
const mapValues = require('lodash/mapValues')
const merge = require('lodash/merge')

const baseConfig = require('./base')
const entrypoints = require('./entrypoints')

const srcDir = path.resolve(__dirname, '../src') + '/'

const config = merge({
  cache: false,
  devtool: 'hidden-source-map',
  entry: mapValues(entrypoints, ({entry}) => ['babel-polyfill'].concat([entry])),
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [new UglifyJsPlugin({
      sourceMap: true,
      uglifyOptions: {warnings: true},
      warningsFilter: source => source.substr(0, srcDir.length) === srcDir,
    })],
  },
  output: {
    filename: '[name].[hash].js',
    path: path.join(__dirname, '/../dist/assets'),
    publicPath: '/assets/',
  },
}, baseConfig)

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


Array.prototype.push.apply(config.plugins, [
  // Define free variables -> global constants.
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': '"production"',
  }),
  new webpack.LoaderOptionsPlugin({
    debug: false,
    minimize: true,
  }),
  // Embed the JavaScript in the index.html page.
  ...Object.keys(entrypoints).filter(key => entrypoints[key].htmlFilename).map(key =>
    new HtmlWebpackPlugin({
      chunks: [key],
      filename: `../${entrypoints[key].htmlFilename}`,
      minify,
      template: path.join(__dirname, '/../src/index.html'),
    })
  ),
  new WebpackPwaManifest({
    lang: 'fr-FR',
    name: 'Bob',
  }),
  new RenameOutputWebpackPlugin(fromPairs(
    Object.keys(entrypoints).filter(key => !entrypoints[key].htmlFilename).
      map(key => [key, '[name].js'])
  )),
])


config.module.rules.push({
  include: [
    path.join(__dirname, '/../src'),
  ],
  test: /\.(js|jsx)$/,
  use: {
    loader: 'babel-loader',
    options: {
      presets: [['env', {modules: false}], 'react', 'stage-0'],
    },
  },
})

module.exports = config
