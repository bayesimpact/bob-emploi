import {Server, config} from 'karma'
import {getAllConfigs, NamedConfigOptions} from './karma.conf'

// TODO(pascal): Fix the watch mode.
const onlyPlugin: Set<string>|undefined = process.argv.slice(2).length ?
  new Set(process.argv.slice(2)) : undefined

const startKarmaServer = async (options: NamedConfigOptions): Promise<number> => {
  const {name, ...karmaConfigOptions} = options
  // eslint-disable-next-line no-console
  console.log(`Testing plugin "${name}"`)
  const karmaConfig = await config.parseConfig(
    null, karmaConfigOptions, {promiseConfig: true, throwErrors: true})
  return new Promise(resolve => {
    new Server(karmaConfig, resolve).start()
  })
}

const testAllConfigs = async (): Promise<number> => {
  const allConfigs = await getAllConfigs()
  const errorCode = await allConfigs.
    filter(config => !onlyPlugin || onlyPlugin.has(config.name)).
    reduce(
      async (resolved, nextConfig) => await resolved + await startKarmaServer(nextConfig),
      Promise.resolve(0),
    )
  return errorCode
}

testAllConfigs().then(process.exit)
