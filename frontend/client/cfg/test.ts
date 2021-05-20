import {parse} from 'json5'
import mapKeys from 'lodash/mapKeys'
import mapValues from 'lodash/mapValues'
import {fileURLToPath} from 'url'
import webpack from 'webpack'

import baseConfig from './base'
import {TestablePlugin} from './plugins'

export default function(
  {colors, constants, srcPath, testPath}: TestablePlugin,
  defaultConstants: Record<string, unknown>,
): webpack.Configuration {
  return {
    devtool: 'eval',
    mode: 'development',
    module: {
      rules: [
        {
          test: /\.(png|jpg|gif|svg|woff|woff2|css|sass|scss|less|styl|txt)$/,
          use: 'null-loader',
        },
        {
          parser: {parse},
          test: /\.json$/,
          type: 'json',
        },
        {
          include: [
            fileURLToPath(new URL('../src', import.meta.url)),
            srcPath,
            testPath,
          ],
          test: /\.[jt]sx?$/,
          use: 'babel-loader',
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        ...mapKeys(mapValues(colors, () => '""'), (color, name) => `colors.${name}`),
        ...mapKeys(mapValues(defaultConstants, () => '""'), (value, key) => `config.${key}`),
        ...mapKeys(mapValues(constants, () => '""'), (value, key) => `config.${key}`),
        'colorsMap': JSON.stringify(colors),
        'config.defaultLang': '"fr"',
        'config.externalLmiUrl': '"http://candidat.pole-emploi.fr/marche-du-travail/statistiques?codeMetier={{codeOgr}}&codeZoneGeographique={{departementId}}&typeZoneGeographique=DEPARTEMENT"',
        'config.googleTopLevelDomain': '"www.google.fr"',
      }),
    ],
    resolve: {
      ...baseConfig.resolve,
      alias: {
        ...baseConfig.resolve.alias,
        deployment: fileURLToPath(new URL('../src/deployments/fr', import.meta.url)),
      },
    },
  }
}
