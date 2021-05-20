const pluginConfig = require('../../i18n.babelrc').plugins[0][1]

module.exports = {
  extends: '../../.babelrc',
  overrides: [
    {
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'upskilling'}]],
      test: './src/*',
    },
  ],
  plugins: [['i18next-extract', pluginConfig]],
}
