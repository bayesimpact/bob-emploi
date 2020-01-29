// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).
const fs = require('fs')
const path = require('path')
const {UnusedFilesWebpackPlugin} = require('unused-files-webpack-plugin')
const entrypoints = require('./entrypoints')
const imageMinJpg = require('imagemin-mozjpeg')
const imageMinPng = require('imagemin-optipng')
const imageMinSvg = require('imagemin-svgo')
// Allow node to require json5 files.
require('json5/lib/register')

const srcPath = path.join(__dirname, '../src')
const sslPath = '/etc/ssl/webpack-dev'

module.exports = {
  devServer: {
    contentBase: './',
    historyApiFallback: {
      rewrites: Object.values(entrypoints).filter(({rewrite}) => rewrite).
        map(({rewrite, htmlFilename}) => ({from: rewrite, to: `/${htmlFilename}`})),
    },
    hot: true,
    https: fs.existsSync(path.join(sslPath, 'key.pem')) ? {
      ca: fs.readFileSync(path.join(sslPath, 'chain.pem')),
      cert: fs.readFileSync(path.join(sslPath, 'cert.pem')),
      key: fs.readFileSync(path.join(sslPath, 'key.pem')),
    } : false,
    noInfo: false,
    port: 80,
    proxy: {
      '/api': {
        secure: false,
        target: 'https://frontend-flask',
      },
    },
    public: 'localhost.bob-dev.bayes.org:3000',
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(eot|ttf|woff2?)(\?[\d&.=a-z]+)?$/,
        use: {
          loader: 'url-loader',
          options: {limit: 8192},
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
            options: {
              // Keep it as CommonJS so that we can use it to render as require in
              // HtmlWebpackPlugin template.
              esModule: false,
              limit: 8192,
            },
          },
          'svg-transform-loader',
          {
            loader: 'img-loader',
            options: {
              enabled: process.env.REACT_WEBPACK_ENV === 'dist',
              plugins: [
                imageMinPng({}),
                imageMinJpg({}),
                imageMinSvg({
                  removeComments: true,
                  removeDesc: true,
                  removeTitle: true,
                }),
              ],
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|gif)(\?[\d&.=a-z]+)?$/,
        use: [
          {
            loader: 'url-loader',
            options: {limit: 8192},
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
      {
        test: /\.json$/,
        type: 'javascript/auto',
        use: 'json5-loader',
      },
    ],
  },
  plugins: [
    new UnusedFilesWebpackPlugin({patterns: [
      'src/**/*.*',
      '!**/README.md',
      '!src/config/*.*',
      '!**/*.d.ts',
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
      translations: path.join(srcPath, 'translations'),
    },
    extensions: ['.js', '.jsx', '_pb.js', '.ts', '.tsx'],
  },
}
