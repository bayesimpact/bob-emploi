/*
 * This module exports the deployment in scope with the following properties:
 * - constants:      the list of constants available in this deployment codebase;
 * - name:           the name of the deployment;
 * - plugins:        the list of plugins (as described in plugins.js) used in this deployment;
 */

import {promises as fs} from 'fs'
import JSON5 from 'json5'
import _isEqual from 'lodash/isEqual'
import _keyBy from 'lodash/keyBy'
import _uniqBy from 'lodash/uniqBy'
import path from 'path'
import {fileURLToPath} from 'url'

import type {Constants, Plugin} from './plugins'
import getAllPlugins, {getCorePlugin} from './plugins'


export type PluginInDeployment = Omit<Plugin, 'deploymentConstants'>

interface DeploymentConfig extends Constants {
  readonly plugins: readonly string[]
}

export interface Deployment {
  readonly name: string
  readonly plugins: readonly PluginInDeployment[]
  readonly prodName: string
}

export interface Deployments {
  [deploymentName: string]: Deployment
  dev: Deployment
}

const CONFIG_REGEX = /(\.json5)$/

const deploymentsDir = fileURLToPath(new URL('deployments', import.meta.url))

async function readJson5<T>(fileName: string): Promise<T> {
  const content = await fs.readFile(fileName, {encoding: 'utf8'})
  return JSON5.parse(content) as T
}

type ConfigRecord<T> = Record<string, T extends 'colors' ? string : unknown>
export const ensureOverride = (deployment: string) => <T extends 'colors'|'config'>(
  configType: T,
  plugin: string,
  isCore: boolean,
  defaultConfig: ConfigRecord<T> = {},
  fromPlugin: ConfigRecord<T> = {},
  fromDeployment: ConfigRecord<T> = {},
  fromPluginDeployment: ConfigRecord<T> = {},
): ConfigRecord<T> => {
  const mergedConfig: ConfigRecord<T> = {
    ...defaultConfig,
    ...fromPlugin,
    ...fromDeployment,
    ...fromPluginDeployment,
  }
  if (isCore) {
    if (!_isEqual(defaultConfig, fromPlugin)) {
      throw new Error('The core plugin config is not the default.')
    }
    if (Object.keys(fromPluginDeployment).length) {
      throw new Error(`The core plugin overrides its own config for deployment ${deployment}`)
    }
    return mergedConfig
  }
  const pluginKeys = new Set(Object.keys(fromPlugin))
  const pluginDeploymentKeys = new Set(Object.keys(fromPluginDeployment))
  const conflictingKeys = Object.keys(fromDeployment).
    filter(key => pluginKeys.has(key) && !pluginDeploymentKeys.has(key))
  if (conflictingKeys.length) {
    throw new Error(
      `The following keys are defined in conflicting ${configType} files
      for deployment ${deployment} and plugin ${plugin}:
      ${conflictingKeys.join(', ')}`)
  }
  return mergedConfig
}

type Config = Constants['config']
const overrideEnv = async (env: 'dev'|'demo'|'showcase', config: Partial<Config>) => {
  const overrides =
    await readJson5<Partial<Config>>(path.join(deploymentsDir, `environments/${env}.json5`))
  return {
    ...config,
    ...Object.fromEntries(
      // Only keep the overrides that actually override a value.
      Object.entries(overrides).filter(([key]) => !!config[key as keyof Config]),
    ),
    ...config.radarProductName as string && {
      radarProductName: `${config.radarProductName} ${env.toUpperCase()}`,
    },
    ...config.productName && env === 'dev' && {productName: `${config.productName} DEV`},
  }
}

async function readDeploymentsFromFile(fileName: string, {colors, config}: Constants):
Promise<readonly Deployment[]> {
  if (!CONFIG_REGEX.test(fileName)) {
    return []
  }
  const stats = await fs.stat(path.join(deploymentsDir, fileName))
  if (!stats.isFile()) {
    return []
  }
  const name = fileName.replace(CONFIG_REGEX, '')
  const deployment = await readJson5<DeploymentConfig>(path.join(deploymentsDir, fileName))
  const allPlugins = await getAllPlugins()
  const pluginsForDeployment = allPlugins.
    filter(({name}) => (deployment.plugins || ['core']).includes(name))
  const demoConstants = Object.fromEntries(
    pluginsForDeployment.map(({name, deploymentConstants}) =>
      [name, (deploymentConstants.demo || {}).config]),
  )
  const devConstants = Object.fromEntries(
    pluginsForDeployment.map(({name, deploymentConstants}) =>
      [name, (deploymentConstants.dev || {}).config]),
  )
  const overrideDeployment = ensureOverride(name)
  const prodDeployment: Deployment = {
    name,
    plugins: pluginsForDeployment.map(({
      constants,
      deploymentConstants: {[name]: fromBoth = {}},
      isCore,
      name: pluginName,
      ...rest
    }) => ({
      ...rest,
      constants: {
        colors: overrideDeployment(
          'colors', pluginName, isCore, colors, constants.colors,
          deployment.colors, fromBoth.colors,
        ),
        config: {
          ...overrideDeployment(
            'config', pluginName, isCore, config, constants.config,
            deployment.config, fromBoth.config,
          ),
          clientVersion: `prod.${name}.${pluginName}.${process.env.CLIENT_VERSION}`,
        },
      },
      isCore,
      name: pluginName,
    })),
    prodName: name,
  }
  return [
    prodDeployment,
    {
      ...prodDeployment,
      name: `${name}Demo`,
      plugins: await Promise.all(
        prodDeployment.plugins.map(async ({constants, name: pluginName, ...rest}) => ({
          ...rest,
          constants: {
            colors: constants.colors,
            config: {
              ...await overrideEnv('demo', constants.config),
              ...demoConstants[pluginName],
            },
          },
          name: pluginName,
        })),
      ),
      prodName: name,
    },
    {
      ...prodDeployment,
      name: `${name}Showcase`,
      plugins: await Promise.all(
        prodDeployment.plugins.map(async ({constants, name: pluginName, ...rest}) => ({
          ...rest,
          constants: {
            colors: constants.colors,
            config: {
              ...await overrideEnv('showcase', constants.config),
              ...demoConstants[pluginName],
            },
          },
          name: pluginName,
        })),
      ),
      prodName: name,
    },
    {
      ...prodDeployment,
      name: `${name}Dev`,
      plugins: await Promise.all(
        prodDeployment.plugins.map(async ({constants, name: pluginName, ...rest}) => ({
          ...rest,
          constants: {
            colors: constants.colors,
            config: {
              ...await overrideEnv('dev', constants.config),
              ...devConstants[pluginName],
            },
          },
          name: pluginName,
        })),
      ),
      prodName: name,
    },
  ]
}

async function getDefaultConstants(): Promise<Constants> {
  const {constants} = await getCorePlugin()
  return constants
}

export const defaultProduct = process.env.BOB_DEPLOYMENT || 'fr'

export async function getDefaultDeploymentConstants(): Promise<Constants['config']> {
  const {config} = await readJson5<DeploymentConfig>(
    path.join(deploymentsDir, `${defaultProduct}.json5`))
  const {config: defaultConfig} = await getDefaultConstants()
  return {
    ...defaultConfig,
    ...config,
  }
}

async function getAllDeployments(): Promise<Deployments> {
  const defaultConstants = await getDefaultConstants()
  const filesAndFolders = await fs.readdir(deploymentsDir)
  const deploymentsPerFile = await Promise.all(
    filesAndFolders.map(fileName => readDeploymentsFromFile(fileName, defaultConstants)))
  const keyedDeployments = _keyBy(deploymentsPerFile.flat(), 'name')

  const devDeployment = keyedDeployments[`${defaultProduct}Dev`]
  if (!devDeployment) {
    throw new Error(
      `Could not find deployment "${defaultProduct}Dev" amongst "${
        Object.keys(keyedDeployments).join('", "')}"`)
  }
  return {
    ...keyedDeployments,
    demo: keyedDeployments[`${defaultProduct}Demo`],
    dev: devDeployment,
    showcase: keyedDeployments[`${defaultProduct}Showcase`],
  }
}

export async function getDistDeployments(pattern?: string): Promise<readonly Deployment[]> {
  const allDeployments = await getAllDeployments()

  const deploymentsRegexp = new RegExp(pattern || '.*(?<!Showcase)$')
  const keptDeployments = _uniqBy(
    Object.keys(allDeployments).
      filter(name => name !== 'test' &&
        !name.toLowerCase().endsWith('dev') &&
        deploymentsRegexp.test(name)).
      map(name => allDeployments[name]),
    'name')

  return keptDeployments
}

export default getAllDeployments
