// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).
const path = require('path')
const webpack = require('webpack')
const {UnusedFilesWebpackPlugin} = require('unused-files-webpack-plugin')
const entrypoints = require('./entrypoints')

const srcPath = path.join(__dirname, '../src')

module.exports = {
  devServer: {
    contentBase: './',
    historyApiFallback: {
      rewrites: Object.values(entrypoints).filter(({rewrite}) => rewrite).
        map(({rewrite, htmlFilename}) => ({from: rewrite, to: `/${htmlFilename}`})),
    },
    hot: true,
    noInfo: false,
    port: 80,
    proxy: {
      '/api': 'http://frontend-flask',
    },
    public: 'localhost.bayes.org:3000',
    publicPath: '/',
  },
  module: {
    rules: [
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
        resourceQuery: /multi/,
        test: /\.(jpe?g|png)$/,
        use: [
          {
            loader: 'responsive-loader',
          },
        ],
      },
      {
        test: /\.svg(\?fill=.*)?$/,
        use: [
          {
            loader: 'url-loader',
            query: {limit: 8192},
          },
          'svg-transform-loader',
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
        test: /\.(png|jpg|gif)(\?[a-z0-9=&.]+)?$/,
        use: [
          {
            loader: 'url-loader',
            query: {limit: 8192},
          },
          {
            loader: 'img-loader',
            options: {
              enabled: process.env.REACT_WEBPACK_ENV === 'dist',
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
    new UnusedFilesWebpackPlugin({patterns: [
      'src/**/*.*',
      '!**/README.md',
      '!src/config/*.*',
    ]}),
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
