// TODO(cyrille): Update docker-react for ts format and separate dev_server config.
import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import getDevServer from './cfg/dev_server'
import configPromise from './cfg/webpack.config'

async function serve(): Promise<void> {
  await new WebpackDevServer(await getDevServer(), webpack(await configPromise)).start()
}

serve()
