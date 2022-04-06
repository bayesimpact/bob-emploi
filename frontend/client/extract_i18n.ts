import {spawn} from 'child_process'
import globSync from 'glob'
import path from 'path'
import {fileURLToPath} from 'url'
import {promisify} from 'util'

import type {Plugin} from './cfg/plugins'
import {actOnPlugins} from './cfg/plugins'

const glob = promisify(globSync)

const extractPlugin = async ({isCore, name, pluginPath, srcPath}: Plugin): Promise<boolean> => {
  const extractConfigModule = path.join(pluginPath, 'i18n.babelrc')
  const configFiles = await glob(`${extractConfigModule}*`)
  if (!configFiles.length) {
    // eslint-disable-next-line no-console
    console.log('No i18n extraction config in plugin', name)
    return false
  }
  const extraFiles = isCore ? path.join(pluginPath, 'release/lambdas/opengraph_redirect.js') : ''
  // TODO(cyrille): Use babel API instead.
  const child = spawn('npx', [
    'babel',
    '--config-file',
    extractConfigModule,
    `${srcPath}/**/*.{js,jsx,ts,tsx}`,
    ...extraFiles && [extraFiles],
  ], {stdio: ['ignore', 'ignore', 'inherit']})
  return new Promise((resolve, reject) => {
    child.on('exit', exitCode => exitCode ? reject() : resolve(true))
    child.on('error', error => reject(error))
  })
}


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  actOnPlugins(extractPlugin, 'extract phrases')(...process.argv.slice(2))
}
