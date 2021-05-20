/*
 * A module to prepare all plugins from the `plugins` root folder.
 *
 * Each plugin is a directory with `cfg` and `src` folders. The `cfg` folder may
 * have files `colors.json5`, `const.json5`, `const_dist.json5` and `entrypoints.js`.
 * Each of these files may overrides keys in the corresponding files of the core cfg folder.
 * Only `entrypoints.js` has to be present (the plugin needs at least one entry).
 *
 * This module exports a function to get the list of available plugins.
 */

import {existsSync, promises as fs} from 'fs'
import JSON5 from 'json5'
import _mapValues from 'lodash/mapValues'
import path from 'path'
import {fileURLToPath} from 'url'

type Constants = Record<string, unknown>

type Colors = Record<string, string>

export interface Entrypoint {
  readonly entry: string
  readonly htmlFilename?: string
  readonly prefixes?: readonly string[]
  readonly template?: string
  readonly usesHotLoader?: true
}

export interface Plugin {
  // The list of colors available in this plugin codebase.
  // This includes, in that order (later addition overrides a previous one):
  // - core colors (i.e. cfg/colors)
  // - plugin colors (e.g. plugins/radar/cfg/colors)
  readonly colors: Colors
  // This includes, in that order (later addition overrides a previous one):
  // - core constants (i.e. cfg/const)
  // - plugin constants (e.g. plugins/radar/cfg/const)
  // - core constants for the given deployment (e.g. cfg/deployments/dev)
  // - plugin constants for the given deployment (e.g. plugins/radar/cfg/deployments/dev)
  readonly constants?: Constants
  // A list of patterns (glob, see karma files option) to define the files that are covered by
  // tests.
  readonly coveragePatterns?: readonly string[]
  readonly demoConstants?: Constants
  readonly devConstants?: Constants
  // The list of entries that this plugin define.
  readonly entrypoints: {[name: string]: Entrypoint}
  // Whether This is a plugin or the core Bob app.
  readonly isCore?: true
  // A map of Webpack modules to load in other entrypoints. The keys are entrypoints from other
  // plugins, and the values are entries that will be loaded and compiled when the corresponding
  // entrypoint is loaded.
  readonly loaders?: Record<string, string>
  // The name of the plugin, defined by its main folder
  readonly name: string
  readonly pluginPath: string
  // The absolute path for the `src` folder for the plugin.
  readonly srcPath: string
  // The absolute path for the `test` folder for the plugin.
  readonly testPath?: string
}

export type TestablePlugin = Plugin & {readonly testPath: NonNullable<Plugin['testPath']>}

async function readJson5<T>(fileName: string): Promise<T> {
  const content = await fs.readFile(fileName, {encoding: 'utf8'})
  return JSON5.parse(content) as T
}

async function maybeReadJson5<T>(fileName: string): Promise<T|undefined> {
  return existsSync(fileName) ? await readJson5<T>(fileName) : undefined
}

const appPluginsDir = path.join(__dirname, '../plugins')

const keptPlugins = new Set((process.env.BOB_PLUGINS || '').split(',').filter(Boolean))
const keepPlugin = (plugin?: Plugin): plugin is Plugin =>
  !!plugin && (!keptPlugins.size || keptPlugins.has(plugin.name))

async function readPluginFromDir(name: string, colors: Colors): Promise<Plugin|undefined> {
  if (name === 'core') {
    return undefined
  }
  const stats = await fs.stat(path.join(appPluginsDir, name))
  if (!stats.isDirectory()) {
    return undefined
  }
  const pluginPath = path.join(appPluginsDir, name)
  const pluginColors = {
    ...colors,
    ...await maybeReadJson5<Colors>(path.join(pluginPath, 'cfg/colors.json5')),
  }
  const constants = await maybeReadJson5<Constants>(path.join(pluginPath, 'cfg/const.json5'))
  const demoConstants = await maybeReadJson5<Constants>(
    path.join(pluginPath, 'cfg/deployments/demo.json5'))
  const devConstants = await maybeReadJson5<Constants>(
    path.join(pluginPath, 'cfg/deployments/dev.json5'))
  const relativeEntrypoints = await readJson5<{[name: string]: Entrypoint}>(
    path.join(pluginPath, 'cfg/entrypoints.json5'))
  const entrypoints = _mapValues(relativeEntrypoints, ({entry, ...rest}) => ({
    ...rest,
    entry: path.join(pluginPath, entry),
  }))
  const loadersPath = path.join(pluginPath, 'src/loaders')
  const loaders = existsSync(loadersPath) ? Object.fromEntries(
    (await fs.readdir(loadersPath)).
      map(filename => filename.replace(/\.tsx?$/, '')).
      map(name => [name, path.join(loadersPath, name)]),
  ) : {}
  const testPath = path.join(pluginPath, 'test')
  const plugin: Plugin = {
    colors: pluginColors,
    constants: constants || {},
    demoConstants,
    devConstants,
    entrypoints,
    loaders,
    name,
    pluginPath,
    srcPath: path.join(pluginPath, 'src'),
    testPath: existsSync(testPath) ? testPath : undefined,
  }
  return plugin
}

async function getAllPlugins(): Promise<readonly Plugin[]> {
  const coreEntrypoints = await readJson5<{[name: string]: Entrypoint}>(
    fileURLToPath(new URL('entrypoints.json5', import.meta.url)))
  const colors = await readJson5<Colors>(fileURLToPath(new URL('colors.json5', import.meta.url)))

  const basePath = fileURLToPath(new URL('..', import.meta.url))
  const core: Plugin = {
    colors,
    coveragePatterns: [path.join(basePath, 'src/store/*.ts')],
    entrypoints: coreEntrypoints,
    isCore: true,
    name: 'core',
    pluginPath: basePath,
    srcPath: path.join(basePath, 'src'),
    testPath: path.join(basePath, 'test/webpack'),
  }

  const filesAndDirs = await fs.readdir(appPluginsDir)
  const allPlugins = await Promise.all(filesAndDirs.map(
    async (name) => await readPluginFromDir(name, colors)))

  // TODO(cyrille): Rather export an object keyed by name.
  const plugins = [core, ...allPlugins].filter(keepPlugin)
  if (!plugins.length) {
    // eslint-disable-next-line no-console
    console.log('No plugin kept!')
  }
  return plugins
}

export default getAllPlugins
