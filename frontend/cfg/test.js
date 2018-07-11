const path = require('path')
const webpack = require('webpack')
const mapKeys = require('lodash/mapKeys')
const mapValues = require('lodash/mapValues')

const baseConfig = require('./base')
const colors = require('./colors.json')
const constants = require('./const.json')


module.exports = {
  devtool: 'eval',
  entry: './test/loadtests.js',
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|svg|woff|woff2|css|sass|scss|less|styl)$/,
        use: 'null-loader',
      },
      {
        include: [
          path.join(__dirname, '../src'),
          path.join(__dirname, '../test'),
        ],
        test: /\.(js|jsx)$/,
        use: 'babel-loader',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      ...mapKeys(mapValues(colors, () => '""'), (color, name) => `colors.${name}`),
      ...mapKeys(mapValues(constants, () => '""'), (value, key) => `config.${key}`),
    }),
  ],
  resolve: baseConfig.resolve,
}
