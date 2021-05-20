// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).
import imageMinJpg from 'imagemin-mozjpeg'
import imageMinPng from 'imagemin-optipng'
import imageMinSvg from 'imagemin-svgo'
import {parse} from 'json5'
import path from 'path'
import {fileURLToPath} from 'url'

const srcPath = fileURLToPath(new URL('../src', import.meta.url))

// Match either plugins/$pluginName/src/images/favicon.ico or images/favicon.ico
// First matched group is undefined or '$pluginName'.
const FAVICON_REGEX = /(?:plugins\/(.*)\/src\/)?images\/favicon\.ico$/

export default {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {esModule: false},
          },
          {
            loader: 'css-loader',
          },
        ],
      },
      {
        test: /\.(pdf|eot|ttf|woff2?)(\?[\d&.=a-z]+)?$/,
        type: 'asset',
      },
      {oneOf: [
        {
          // SVG files loaded with `original` in their query won't be transformed.
          resourceQuery: /original/,
          test: /\.svg$/,
          type: 'asset',
        },
        {
          test: /\.svg(\?fill=.*)?$/,
          type: 'asset',
          use: [
            'svg-transform-loader',
            {
              loader: 'img-loader',
              options: {
                enabled: process.env.REACT_WEBPACK_ENV === 'dist',
                plugins: [
                  imageMinPng({}),
                  imageMinJpg({}),
                  imageMinSvg(),
                ],
              },
            },
          ],
        },
      ]},
      {
        generator: {
          filename: process.env.REACT_WEBPACK_ENV === 'dist' ?
            ({filename, url}: {filename?: string; url: string}) => {
              if (!filename) {
                throw new Error(`Failed to load file "${url}"`)
              }
              const [, plugin] = filename.match(FAVICON_REGEX) || []
              if (plugin) {
                // output favicon.ico in subpath, to allow a specific directive on servers
                // (nginx or Cloudfront).
                return path.join('..', plugin, 'favicon.ico')
              }
              return '../favicon.ico'
            } : 'favicon.ico',
          publicPath: '/',
        },
        test: /favicon\.ico$/,
        type: 'asset/resource',
      },
      {
        test: /\.(png|jpg|gif)(\?[\d&.=a-z]+)?$/,
        type: 'asset',
        use: [
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
        type: 'asset/source',
      },
      {
        parser: {parse},
        test: /\.json$/,
        type: 'json',
      },
      {
        include: [
          fileURLToPath(new URL('../release', import.meta.url)),
        ],
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          // Override default options from .babelrc.
          options: {
            presets: [['@babel/env', {modules: false}]],
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      api: fileURLToPath(new URL('../bob_emploi/frontend/api', import.meta.url)),
      deployment: fileURLToPath(new URL('../src/deployments/fr', import.meta.url)),
      translations: fileURLToPath(new URL('../i18n/translations', import.meta.url)),
      // TODO(cyrille): Consider adding plugin paths in alias, once webpack5 is out.
      ...Object.fromEntries(['components', 'hooks', 'images', 'store', 'styles'].
        map(name => [name, path.join(srcPath, name)])),
    },
    extensions: ['.js', '.jsx', '_pb.js', '.ts', '.tsx'],
  },
}
