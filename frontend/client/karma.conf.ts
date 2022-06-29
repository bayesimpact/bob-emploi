import type {Config, ConfigOptions} from 'karma'
import path from 'path'
import puppeteer from 'puppeteer'
import type {Configuration as WebpackConfiguration} from 'webpack'

import {getDefaultDeploymentConstants} from './cfg/deployment'
import type {TestablePlugin} from './cfg/plugins'
import getAllPlugins from './cfg/plugins'
import createWebpackTestConfig from './cfg/test'

export interface NamedConfigOptions extends ConfigOptions {
  client?: ConfigOptions['client'] & {mocha?: unknown}
  coverageReporter?: unknown
  name: string
  webpack?: WebpackConfiguration
  webpackServer?: unknown
}

async function getAllConfigs(): Promise<readonly NamedConfigOptions[]> {
  const defaultConstants = await getDefaultDeploymentConstants()
  const plugins = await getAllPlugins()
  const testablePlugins = plugins.filter((p): p is TestablePlugin => !!p.testPath)
  return testablePlugins.map((plugin: TestablePlugin): NamedConfigOptions => {
    const {coveragePatterns, name, testPath} = plugin
    const preprocessors = {[path.join(testPath, '**/*.ts')]: ['webpack', 'sourcemap']}
    for (const pattern of (coveragePatterns || [])) {
      preprocessors[pattern] = ['webpack', 'sourcemap', 'coverage']
    }
    const pluginWebpackCfg = createWebpackTestConfig(plugin, defaultConstants)
    const files = Object.keys(preprocessors)
    return {
      autoWatch: false,
      basePath: '',
      browsers: ['ChromeHeadlessNoSandbox'],
      captureTimeout: 60_000,
      client: {
        captureConsole: false,
        mocha: {},
      },
      coverageReporter: {
        dir: 'coverage/',
        subdir: '.',
        type: 'lcov',
      },
      customLaunchers: {
        ChromeHeadlessNoSandbox: {
          base: 'ChromeHeadless',
          flags: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
      files,
      frameworks: ['mocha', 'chai', 'webpack'],
      name,
      port: 8080,
      preprocessors,
      reporters: ['mocha', 'coverage'],
      singleRun: true,
      webpack: pluginWebpackCfg,
      webpackServer: {
        noInfo: true,
      },
    }
  })
}

process.env.REACT_WEBPACK_ENV = 'test'
// TODO(pascal): Drop those once https://github.com/puppeteer/puppeteer/issues/6899 is fixed.
interface Puppeteer {
  executablePath(): string
}
process.env.CHROME_BIN = (puppeteer as unknown as Puppeteer).executablePath()

interface CustomConfig extends Config {
  grep?: string
}

const updateConfig = async (config: CustomConfig): Promise<void> => {
  const pluginName = process.env.BOB_PLUGIN_TEST || 'core'
  const allConfigs = await getAllConfigs()
  const pluginConfig = allConfigs.find(({name}) => name === pluginName)
  if (!pluginConfig) {
    throw new Error(`Missing test config for plugin ${pluginName}`)
  }
  let finalConfig = pluginConfig
  if (config.grep && pluginConfig) {
    finalConfig = {
      ...pluginConfig,
      client: {
        ...pluginConfig.client,
        args: ['--grep', config.grep],
      },
    }
  }
  config.set(finalConfig)
}

export {updateConfig as default, getAllConfigs}
