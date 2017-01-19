// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).

var path = require('path')
var webpack = require('webpack')

var port = 80
var srcPath = path.join(__dirname, '/../src')

module.exports = {
  devServer: {
    contentBase: './src/',
    historyApiFallback: true,
    hot: true,
    noInfo: false,
    port: port,
    publicPath: '/',
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        include: path.join(__dirname, 'src'),
        test: /\.(js|jsx)$/,
        use: 'eslint-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|gif|eot|ttf|woff2?)(\?[a-z0-9=&.]+)?$/,
        use: 'url-loader?limit=8192',
      },
      {
        test: /\.svg(\?[a-z0-9=&.]+)?$/,
        use: [
          'url-loader?limit=8192',
          'svgo-loader?' + JSON.stringify({
            plugins: [
              {removeTitle: true},
              {removeComments: true},
              {removeDesc: true},
            ],
          }),
        ],
      },
      {
        test: /\.txt$/,
        use: 'raw-loader',
      },
    ],
  },
  plugins: [
    // fetch polyfill
    new webpack.ProvidePlugin({
      'fetch': 'imports-loader?this=>global!exports-loader?global.fetch!whatwg-fetch',
    }),
  ],
  resolve: {
    alias: {
      api: srcPath + '/../bob_emploi/frontend/api',
      components: srcPath + '/components/',
      config: srcPath + '/config/' + process.env.REACT_WEBPACK_ENV,
      images: srcPath + '/images/',
      store: srcPath + '/store/',
      styles: srcPath + '/styles/',
    },
    extensions: ['.js', '.jsx', '_pb.js'],
  },
}
