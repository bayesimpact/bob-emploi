// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).
const path = require('path')
const webpack = require('webpack')
const {UnusedFilesWebpackPlugin} = require('unused-files-webpack-plugin')

const srcPath = path.join(__dirname, '../src')

module.exports = {
  devServer: {
    contentBase: './src/',
    historyApiFallback: {
      rewrites: [
        {from: /^\/eval($|\/)/, to: '/eval.html'},
        {from: /^\/unsubscribe/, to: '/unsubscribe.html'},
      ],
    },
    hot: true,
    noInfo: false,
    port: 80,
    public: 'localhost.bayes.org:3000',
    publicPath: '/',
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        include: srcPath,
        test: /\.(js|jsx)$/,
        use: {
          loader: 'eslint-loader',
          options: {emitWarning: true},
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(eot|ttf|woff2?)(\?[a-z0-9=&.]+)?$/,
        use: {
          loader: 'url-loader',
          query: {limit: 8192},
        },
      },
      {
        test: /\.(png|jpg|gif|svg)(\?[a-z0-9=&.]+)?$/,
        use: [
          {
            loader: 'url-loader',
            query: {limit: 8192},
          },
          {
            loader: 'img-loader',
            options: {
              enabled: process.env.REACT_WEBPACK_ENV === 'dist',
              svgo: {
                plugins: [
                  {removeTitle: true},
                  {removeComments: true},
                  {removeDesc: true},
                ],
              },
            },
          },
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
      fetch: 'imports-loader?this=>global!exports-loader?global.fetch!whatwg-fetch',
    }),
    new UnusedFilesWebpackPlugin({
      globOptions: {ignore: ['**/README.md', 'src/config/*.*']},
      pattern: 'src/**/*.*',
    }),
  ],
  resolve: {
    alias: {
      api: path.join(srcPath, '../bob_emploi/frontend/api'),
      components: path.join(srcPath, 'components'),
      config: path.join(srcPath, 'config', process.env.REACT_WEBPACK_ENV),
      images: path.join(srcPath, 'images'),
      store: path.join(srcPath, 'store'),
      styles: path.join(srcPath, 'styles'),
    },
    extensions: ['.js', '.jsx', '_pb.js'],
  },
}
