import type {SpawnOptions} from 'child_process'
import {spawn} from 'child_process'
import {existsSync} from 'fs'
import {fileURLToPath} from 'url'

import generateDeploymentsTest from './node/generate_deployments_test'
import type {Plugin} from './cfg/plugins'
import {actOnPlugins} from './cfg/plugins'

// TODO(cyrille): DRY this with extract_i18n.
const exec = (command: string, args: readonly string[], options?: SpawnOptions): Promise<void> => {
  const child = options ? spawn(command, args, options) : spawn(command, args)
  return new Promise((resolve, reject) => {
    child.on('exit', exitCode => exitCode ? reject() : resolve())
    child.on('error', error => reject(error))
  })
}

const checkPluginTypes = async ({name, isCore}: Plugin): Promise<boolean> => {
  if (isCore) {
    generateDeploymentsTest('/tmp/bob_emploi/test_deployment_types.ts')
  }
  const configFile = fileURLToPath(new URL(
    isCore ? './tsconfig.json' : `./plugins/${name}/tsconfig.json`, import.meta.url))
  if (!existsSync(configFile)) {
    // eslint-disable-next-line no-console
    console.log('No typescript config for plugin', name)
    return false
  }
  // TODO(cyrille): Use typescript API instead.
  await exec('npx', ['tsc', '-p', configFile], {stdio: ['ignore', 'inherit', 'inherit']})
  return true
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  actOnPlugins(checkPluginTypes, 'check types')(...process.argv.slice(2))
}
