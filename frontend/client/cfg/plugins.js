/*
 * A module to prepare all plugins from the `plugins` root folder.
 *
 * Each plugin is a directory with `cfg` and `src` folders. The `cfg` folder may
 * have files `colors.json5`, `const.json5`, `const_dist.json5` and `entrypoints.js`.
 * Each of these files may overrides keys in the corresponding files of the core cfg folder.
 * Only `entrypoints.js` has to be present (the plugin needs at least one entry).
 *
 * This module exports the list of available plugins as objects with the following properties:
 * - colors:         the list of colors available in this plugin codebase;
 * - constants:      the list of constants available in DEV mode in this plugin codebase;
 * - distConstants:  the list of constants available in PROD mode in this plugin codebase
 * - entrypoints:    the list of entries that this plugin define;
 * - isCore:         whether this is a plugin or the core Bob app;
 * - name:           the name of the plugin, defined by its main folder;
 * - srcPath:        the absolute path for the `src` folder for the plugin.
 # - extractedLangs: for translated plugins. A Set of langs that are extracted for i18next.
 */

const fs = require('fs')
const path = require('path')

let noJson5 = false
// Allow node to require json5 files.
try {
  require('json5/lib/register')
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    noJson5 = true
    // eslint-disable-next-line no-console
    console.warn('Unable to load JSON5 files. Will fallback to empty objects.')
  }
}

const maybeRequire = (path, mustBeFound = false) => {
  if (noJson5 && path.endsWith('.json5')) {
    return
  }
  try {
    return require(path)
  } catch (error) {
    if (!mustBeFound && error.code === 'MODULE_NOT_FOUND') {
      return
    }
    throw error
  }
}

const colors = maybeRequire('./colors.json5', true)
const constants = maybeRequire('./const.json5', true)

const distConstants = {
  ...constants,
  ...maybeRequire('./const_dist.json5', true),
}


const appPluginsDir = path.join(__dirname, '../plugins')

const getExtractedLangs = (rootPath) => {
  // TODO(cyrille): Ensure the required file is in JS object format.
  const i18nBabelConfig = maybeRequire(path.join(rootPath, 'i18n.babelrc'))
  if (!i18nBabelConfig) {
    return new Set([])
  }
  const i18nBabelPlugin = i18nBabelConfig.plugins.find(babelPlugin =>
    babelPlugin.length && babelPlugin[0] === 'i18next-extract')
  if (!i18nBabelPlugin) {
    // eslint-disable-next-line no-console
    console.warn(`Folder ${rootPath} has an i18n babel config without the i18next-extract plugin.`)
    return new Set([])
  }
  const {locales = ['en']} = i18nBabelPlugin[1] || {}
  return new Set(locales)
}
const plugins = fs.readdirSync(appPluginsDir).
  filter(name => fs.statSync(path.join(appPluginsDir, name)).isDirectory()).
  map(name => {
    const pluginPath = path.join(appPluginsDir, name)
    const pluginColors = {
      ...colors,
      ...maybeRequire(path.join(pluginPath, 'cfg/colors.json5')),
    }
    const pluginConstants = {
      ...constants,
      ...maybeRequire(path.join(pluginPath, 'cfg/const.json5')),
    }
    const pluginDistConstants = {
      ...distConstants,
      ...maybeRequire(path.join(pluginPath, 'cfg/const.json5')),
      ...maybeRequire(path.join(pluginPath, 'cfg/const_dist.json5')),
    }
    return {
      colors: pluginColors,
      constants: pluginConstants,
      distConstants: pluginDistConstants,
      entrypoints: require(path.join(pluginPath, 'cfg/entrypoints')),
      extractedLangs: getExtractedLangs(pluginPath),
      name,
      srcPath: path.join(pluginPath, 'src'),
    }
  })

const core = {
  colors,
  constants,
  distConstants,
  entrypoints: require('./entrypoints'),
  extractedLangs: getExtractedLangs(path.join(__dirname, '..')),
  isCore: true,
  name: 'core',
  srcPath: path.join(__dirname, '../src'),
}

// TODO(cyrille): Rather export an object keyed by name.
module.exports = [core, ...plugins]
