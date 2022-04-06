/*
 * A module to prepare all plugins from the `plugins` root folder.
 *
 * Each plugin is a directory with `cfg` and `src` folders. The `cfg` folder may
 * have files `colors.json5`, `config.json5` and `entrypoints.js`.
 // TODO(cyrille): Update documentation for the new environmet behaviour.
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

export type Colors = Record<string, string>
export type Config = Record<string, unknown> & {productName?: string}

export interface Constants {
  // The list of colors available in this plugin codebase.
  // This includes, in that order (later addition overrides a previous one):
  // - core colors (i.e. cfg/colors)
  // - plugin colors (e.g. plugins/radar/cfg/colors)
  colors: Colors
  // The config includes, in that order (later addition overrides a previous one):
  // - core config (i.e. cfg/config)
  // - plugin config (e.g. plugins/radar/cfg/config)
  // - core config for the given deployment (e.g. cfg/deployments/dev)
  // - plugin config for the given deployment (e.g. plugins/radar/cfg/deployments/dev)
  config: Config
}

export interface Entrypoint {
  readonly entry: string
  readonly htmlFilename?: string
  readonly prefixes?: readonly string[]
  // The source for rendering the HTML template in which the JS will be inserted.
  // This is given as a path relative to the plugin's src folder.
  readonly template?: string
  // A list of ts/tsx files needed to render the template.
  // These are given as paths relative to the plugin's src folder.
  readonly templateDependencies?: readonly string[]
}

export interface Plugin {
  readonly constants: Constants
  // A list of patterns (glob, see karma files option) to define the files that are covered by
  // tests.
  readonly coveragePatterns?: readonly string[]
  readonly deploymentConstants: Record<string, Constants>
  // The list of entries that this plugin define.
  readonly entrypoints: {[name: string]: Entrypoint}
  // Whether This is a plugin or the core Bob app.
  readonly isCore: boolean
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

const projectRootDir = fileURLToPath(new URL('..', import.meta.url))
const appPluginsDir = path.join(projectRootDir, 'plugins')

const keptPlugins = new Set((process.env.BOB_PLUGINS || '').split(',').filter(Boolean))
const keepPlugin = (plugin?: Plugin): plugin is Plugin =>
  !!plugin && (!keptPlugins.size || keptPlugins.has(plugin.name))

async function readPluginFromDir(name: string): Promise<Plugin|undefined> {
  if (name === 'core') {
    return undefined
  }
  const stats = await fs.stat(path.join(appPluginsDir, name))
  if (!stats.isDirectory()) {
    return undefined
  }
  const pluginPath = path.join(appPluginsDir, name)
  // TODO(cyrille): Merge colors and const in a single JSON5.
  const colors = await maybeReadJson5<Colors>(path.join(pluginPath, 'cfg/colors.json5')) || {}
  const config = await maybeReadJson5<Config>(path.join(pluginPath, 'cfg/config.json5')) || {}
  const constantsFolder = path.join(pluginPath, 'cfg/deployments')
  const constantsFiles = existsSync(constantsFolder) ? await fs.readdir(constantsFolder) : []
  const deploymentConstants = Object.fromEntries(await Promise.all(constantsFiles.
    filter(filename => filename.endsWith('.json5')).
    map(async filename => [
      filename.replace(/\.json5$/, ''),
      await readJson5<Constants>(path.join(constantsFolder, filename)),
    ]),
  ))
  const relativeEntrypoints = await readJson5<{[name: string]: Entrypoint}>(
    path.join(pluginPath, 'cfg/entrypoints.json5'))
  const entrypoints = _mapValues(relativeEntrypoints, ({entry, ...rest}) => ({
    ...rest,
    entry: path.join(pluginPath, entry),
  }))
  const loadersPath = path.join(pluginPath, 'src/loaders')
  const loadersFile = existsSync(loadersPath) && await fs.readdir(loadersPath)
  const loaders = loadersFile ? Object.fromEntries(
    loadersFile.
      map(filename => filename.replace(/\.tsx?$/, '')).
      map(name => [name, path.join(loadersPath, name)]),
  ) : {}
  const testPath = path.join(pluginPath, 'test')
  const plugin: Plugin = {
    constants: {colors, config},
    deploymentConstants,
    entrypoints,
    isCore: false,
    loaders,
    name,
    pluginPath,
    srcPath: path.join(pluginPath, 'src'),
    testPath: existsSync(testPath) ? testPath : undefined,
  }
  return plugin
}

export const getCorePlugin = async (): Promise<Plugin> => {
  const coreEntrypoints = await readJson5<{[name: string]: Entrypoint}>(
    fileURLToPath(new URL('entrypoints.json5', import.meta.url)))
  const colors = await readJson5<Record<string, string>>(
    fileURLToPath(new URL('colors.json5', import.meta.url)))
  const config = await readJson5<Record<string, unknown>>(
    fileURLToPath(new URL('config.json5', import.meta.url)))
  // TODO(cyrille): Move deployment constants import here.

  const basePath = fileURLToPath(new URL('..', import.meta.url))
  return {
    constants: {colors, config},
    coveragePatterns: [path.join(basePath, 'src/store/*.ts')],
    deploymentConstants: {},
    entrypoints: coreEntrypoints,
    isCore: true,
    name: 'core',
    pluginPath: basePath,
    srcPath: path.join(basePath, 'src'),
    testPath: path.join(basePath, 'test/webpack'),
  }
}

async function getAllPlugins(): Promise<readonly Plugin[]> {
  const filesAndDirs = await fs.readdir(appPluginsDir)
  const allPlugins = await Promise.all(filesAndDirs.map(readPluginFromDir))
  const core = await getCorePlugin()
  const plugins = [core, ...allPlugins].filter(keepPlugin)
  if (!plugins.length) {
    // eslint-disable-next-line no-console
    console.log('No plugin kept!')
  }
  return plugins
}

type HtmlEntrypoint = {[F in 'htmlFilename' | 'prefixes']: NonNullable<Entrypoint[F]>}
interface PrefixedEntry {
  htmlFilename: string
  prefix: string
}
export const getEntrypoints = (plugins: readonly Partial<Plugin>[]): readonly PrefixedEntry[] => {
  const prefixedEntrypoints = plugins.
    flatMap(({entrypoints}) => Object.values(entrypoints || {})).
    filter((e): e is Entrypoint & HtmlEntrypoint => !!e.prefixes && !!e.htmlFilename).
    flatMap(({htmlFilename, prefixes}) => prefixes.map(prefix => ({htmlFilename, prefix})))
  const hasRoot = !prefixedEntrypoints.length || plugins.some(({isCore}) => isCore)
  return [
    ...prefixedEntrypoints,
    {
      htmlFilename: hasRoot ? 'index.html' : prefixedEntrypoints[0].htmlFilename,
      prefix: '',
    },
  ]
}

const getHintedPluginPredicate = (onlyPluginHint: string): ((p: Plugin) => boolean) =>
  ({name, srcPath}) => name === onlyPluginHint ||
    onlyPluginHint.startsWith(path.relative(projectRootDir, srcPath))

/* eslint-disable no-console */
export const actOnPlugins = (pluginHandler: (p: Plugin) => Promise<boolean>, action: string):
((o?: string) => Promise<void>) => async (onlyPluginHint?: string, hintPrefix?: string) => {
  onlyPluginHint = onlyPluginHint && hintPrefix && path.relative(hintPrefix, onlyPluginHint) ||
    onlyPluginHint
  const allPlugins = await getAllPlugins()
  if (onlyPluginHint) {
    const plugin = allPlugins.find(getHintedPluginPredicate(onlyPluginHint))
    if (!plugin) {
      throw new Error(`No plugin found from hint "${onlyPluginHint}".`)
    }
    console.log(`Starting to ${action} just for plugin`, plugin.name, '…')
    const hasActed = await pluginHandler(plugin)
    if (!hasActed) {
      throw new Error(`Unable to ${action} on plugin ${plugin.name}`)
    }
    return
  }
  let hasErrors = false
  for (const plugin of allPlugins) {
    try {
      console.log(`Starting to ${action} for plugin`, plugin.name, '…')
      // eslint-disable-next-line no-await-in-loop
      const hasActed = await pluginHandler(plugin)
      if (!hasActed) {
        console.warn(`Unable to ${action} on plugin`, plugin.name)
      }
    } catch (error) {
      console.error(`An error occurred while trying to ${action} for plugin`, plugin.name, error)
      hasErrors = true
    }
  }
  if (hasErrors) {
    throw new Error(`An error occurred while trying to ${action} for plugins,
      please check the logs.`)
  }
}
/* eslint-enable no-console */

export default getAllPlugins
