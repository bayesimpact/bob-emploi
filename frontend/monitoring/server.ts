// TODO(cyrille): Update docker-react for ts format and separate dev_server config.
import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import devServer from './cfg/dev_server'
import config from './cfg/webpack.config'

const serve = async () => {
  await new WebpackDevServer(devServer, webpack(config)).start()
  const {host, port} = devServer
  console.log(`Listening at ${host}:${port}`) // eslint-disable-line no-console
}

serve()
