const pluginConfig = require('../../i18n.babelrc').plugins[0][1]

module.exports = {
  extends: '../../.babelrc',
  plugins: [['i18next-extract', pluginConfig]],
}
