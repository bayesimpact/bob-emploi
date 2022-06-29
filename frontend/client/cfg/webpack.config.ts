import type {Configuration} from 'webpack'

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
async function buildConfig(env: string): Promise<readonly Configuration[]> {
  const usedEnv = getValidEnv(env)
  const {default: getConfiggetConfig} = await import(`./${usedEnv}`)
  return getConfiggetConfig()
}

process.traceDeprecation = true

export default buildConfig(process.env.REACT_WEBPACK_ENV)
