// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).

var path = require('path')

var port = 80
var srcPath = path.join(__dirname, '/../src')

const publicPath = '/assets/'

module.exports = {
  debug: true,
  devServer: {
    contentBase: './src/',
    historyApiFallback: true,
    hot: true,
    noInfo: false,
    port: port,
    publicPath: '/',
  },
  host: process.env.BIND_HOST || 'localhost',
  module: {
    loaders: [
      {
        loader: 'style!css',
        test: /\.css$/,
      },
      {
        loader: 'url-loader?limit=8192',
        test: /\.(png|jpg|gif|eot|ttf|woff2?)(\?[a-z0-9=&.]+)?$/,
      },
      {
        loaders: [
          'url-loader?limit=8192',
          'svgo-loader?' + JSON.stringify({
            plugins: [
              {removeTitle: true},
              {removeComments: true},
              {removeDesc: true},
            ],
          }),
        ],
        test: /\.svg(\?[a-z0-9=&.]+)?$/,
      },
      {
        loader: 'json',
        test: /\.json$/,
      },
      {
        loader: 'raw',
        test: /\.txt$/,
      },
    ],
    preLoaders: [
      {
        include: path.join(__dirname, 'src'),
        loader: 'eslint-loader',
        test: /\.(js|jsx)$/,
      },
    ],
  },
  port: port,
  publicPath,
  resolve: {
    alias: {
      api: srcPath + '/../bob_emploi/frontend/api',
      components: srcPath + '/components/',
      config: srcPath + '/config/' + process.env.REACT_WEBPACK_ENV,
      images: srcPath + '/images/',
      store: srcPath + '/store/',
      styles: srcPath + '/styles/',
    },
    extensions: ['', '.js', '.jsx', '_pb.js'],
  },
}
