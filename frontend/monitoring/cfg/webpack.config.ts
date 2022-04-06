import type {Configuration} from 'webpack'

import dev from './dev'
import dist from './dist'

// Set the correct environment.
if (!process.env.REACT_WEBPACK_ENV) {
  process.env.REACT_WEBPACK_ENV = 'dev'
}

const configNames = ['dev', 'dist'] as const
const configNameSet = new Set(configNames)
type ConfigName = typeof configNames[number]

/**
 * Get an allowed environment
 */
function getValidEnv(env: string): ConfigName {
  const isValid = env && env.length > 0 && configNameSet.has(env as ConfigName)
  return isValid ? env as ConfigName : 'dev'
}

/**
 * Build the webpack configuration
 */
function buildConfig(env: string): Configuration {
  const usedEnv = getValidEnv(env)
  return usedEnv === 'dist' ? dist : dev
}

export default buildConfig(process.env.REACT_WEBPACK_ENV)
