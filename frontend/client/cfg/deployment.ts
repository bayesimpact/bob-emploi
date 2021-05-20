/*
 * This module exports the deployment in scope with the following properties:
 * - constants:      the list of constants available in this deployment codebase;
 * - name:           the name of the deployment;
 * - plugins:        the list of plugins (as described in plugins.js) used in this deployment;
 */

import {promises as fs} from 'fs'
import JSON5 from 'json5'
import _flatMap from 'lodash/flatMap'
import _keyBy from 'lodash/keyBy'
import path from 'path'
import {fileURLToPath} from 'url'

import prodToDev from './deployments/environments/dev'
import prodToDemo from './deployments/environments/demo'

import getAllPlugins, {Plugin} from './plugins'

interface Constants extends Record<string, unknown> {
  productName: string
}

export type PluginInDeployment = Omit<Plugin, 'demoConstants'|'devConstants'|'constants'> & {
  constants: Constants
}

interface DeploymentConfig {
  readonly colors?: {[name: string]: string}
  readonly constants?: Record<string, unknown>
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

async function readDeploymentsFromFile(
  fileName: string, defaultConstants: Constants,
): Promise<readonly Deployment[]> {
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
    // TODO(cyrille): Consider defaulting to all plugins.
    filter(({name}) => (deployment.plugins || ['core']).includes(name))
  const demoConstants = Object.fromEntries(
    pluginsForDeployment.map(({name, demoConstants}) => [name, demoConstants]),
  )
  const devConstants = Object.fromEntries(
    pluginsForDeployment.map(({name, demoConstants}) => [name, demoConstants]),
  )
  const prodDeployment: Deployment = {
    name,
    plugins: pluginsForDeployment.map(({
      colors, constants: pluginConstants,
      devConstants: unusedDevConstants,
      demoConstants: unusedDemoConstants,
      ...rest
    }) => ({
      ...rest,
      colors: {...colors, ...deployment.colors},
      constants: {
        clientVersion: `prod.${name}.${process.env.CLIENT_VERSION}`,
        ...defaultConstants,
        ...deployment.constants,
        ...pluginConstants,
      },
    })),
    prodName: name,
  }
  return [
    prodDeployment,
    {
      ...prodDeployment,
      name: `${name}Demo`,
      plugins: prodDeployment.plugins.map(({constants, name: pluginName, ...rest}) => ({
        ...rest,
        constants: prodToDemo(name, constants, demoConstants[pluginName]),
        name: pluginName,
      })),
      prodName: name,
    },
    {
      ...prodDeployment,
      name: `${name}Dev`,
      plugins: prodDeployment.plugins.map(
        ({constants, name: pluginName, ...rest}): PluginInDeployment => ({
          ...rest,
          constants: prodToDev(name, constants, devConstants[pluginName]),
          name: pluginName,
        }),
      ),
      prodName: name,
    },
  ]
}

function getDefaultConstants(): Promise<Constants> {
  return readJson5<Constants>(fileURLToPath(new URL('const.json5', import.meta.url)))
}

const defaultProduct = process.env.BOB_DEPLOYMENT || 'fr'

export async function getDefaultDeploymentConstants(): Promise<Constants> {
  const deployment = await readJson5<DeploymentConfig>(
    path.join(deploymentsDir, `${defaultProduct}.json5`))
  return {
    ...await getDefaultConstants(),
    ...deployment.constants,
  }
}

async function getAllDeployments(): Promise<Deployments> {
  const defaultConstants = await getDefaultConstants()
  const filesAndFolders = await fs.readdir(deploymentsDir)
  const deploymentsPerFile = await Promise.all(filesAndFolders.map(
    async (fileName) => await readDeploymentsFromFile(fileName, defaultConstants)))
  const keyedDeployments = _keyBy(_flatMap(deploymentsPerFile), 'name')

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
  }
}

export default getAllDeployments
