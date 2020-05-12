// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).
const path = require('path')
const {UnusedFilesWebpackPlugin} = require('unused-files-webpack-plugin')
const plugins = require('./plugins')
const imageMinJpg = require('imagemin-mozjpeg')
const imageMinPng = require('imagemin-optipng')
const imageMinSvg = require('imagemin-svgo')

const baseSrcPath = path.join(__dirname, '../src')

module.exports = plugins.map(({isCore, name}) => {
  return {
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
          loader: 'json5-loader',
          options: {
            esModule: false,
          },
          test: /\.json$/,
          type: 'javascript/auto',
        },
      ],
    },
    plugins: [
      new UnusedFilesWebpackPlugin({patterns: [
        ...isCore ? [
          'src/**/*.*',
          '!src/config/*.*',
        ] : [`plugins/${name}/src/**/*.*`],
        '!**/README.md',
        '!**/*.d.ts',
      ]}),
    ],
    resolve: {
      alias: {
        api: path.join(__dirname, '../bob_emploi/frontend/api'),
        // TODO(cyrille): Check it's unused, and drop.
        config: path.join(baseSrcPath, 'config', process.env.REACT_WEBPACK_ENV),
        // TODO(cyrille): Consider adding plugin paths in alias, once webpack5 is out.
        ...Object.fromEntries(['components', 'images', 'store', 'styles', 'translations'].
          map(name => [name, path.join(baseSrcPath, name)])),
      },
      extensions: ['.js', '.jsx', '_pb.js', '.ts', '.tsx'],
    },
  }
})
