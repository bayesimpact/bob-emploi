// This file is the base configuration for the [webpack module bundler](https://webpack.github.io/).
// Use this file to edit settings that are the same for all environments (dev, test, prod).
import imageMinJpg from 'imagemin-mozjpeg'
import imageMinPng from 'imagemin-optipng'
import imageMinSvg from 'imagemin-svgo'
import {parse} from 'json5'
import {fileURLToPath} from 'url'
import type {RuleSetRule} from 'webpack'

import type {Colors, Config} from './plugins'
import simpleConfig from './simple.json'

// Create a value to log missing keys in a DefinePlugin "object".
export const makeDefinitionFallback = (
  config: Config|Colors,
  configName: 'colors'|'config',
  envName: string,
): string => `new Proxy(${JSON.stringify(config)}, {
  get: (target, property) => {
    const result = target[property]
    if (typeof result === "undefined") {
      throw new Error('${configName}.' + property + ' is not defined in ${envName}.')
    }
    return result
  }
})`
// Create a rule to handle CSS imports.
//
// Add this rule as parat of a webpack rule set.
//
// It takes a color map so that color names are available as Sass variables (e.g.
// $colors-MAIN_COLOR) in the CSS files.
export const createCSSRule = (colors: Colors): RuleSetRule => ({
  test: /\.css$/,
  use: [
    {
      loader: 'style-loader',
      options: {esModule: false},
    },
    {
      loader: 'css-loader',
    },
    {
      loader: 'sass-loader',
      options: {
        additionalData: Object.entries(colors).
          map(([name, value]) => `$colors-${name}: ${value}`).
          join(';') + ';',
      },
    },
  ],
})

export default {
  ...simpleConfig,
  module: {
    rules: [
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
                  imageMinSvg(),
                ],
              },
            },
          ],
        },
      ]},
      ...process.env.REACT_WEBPACK_ENV === 'dist' ? [] : [{
        generator: {
          filename: 'favicon.ico',
          publicPath: '/',
        },
        test: /favicon\.ico$/,
        type: 'asset/resource',
      }],
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
    ...simpleConfig.resolve,
    alias: {
      ...simpleConfig.resolve.alias,
      // TODO(cyrille): Drop this once https://github.com/microsoft/TypeScript/issues/32063 is resolved.
      config: false as const,
    },
  },
}
