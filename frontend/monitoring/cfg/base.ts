// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).
import imageMinJpg from 'imagemin-mozjpeg'
import imageMinPng from 'imagemin-optipng'
import {parse} from 'json5'

import simpleConfig from './simple.json'

export default {
  ...simpleConfig,
  entry: ['whatwg-fetch', './src/entry'],
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
      {
        generator: {
          filename: process.env.REACT_WEBPACK_ENV === 'dist' ? '../favicon.ico' : 'favicon.ico',
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
              plugins: [
                imageMinPng({}),
                imageMinJpg({}),
              ],
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
        test: /\.json5?$/,
        type: 'json',
      },
    ],
  },
}
