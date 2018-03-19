const path = require('path')

const baseConfig = require('./base')

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
  resolve: baseConfig.resolve,
}
