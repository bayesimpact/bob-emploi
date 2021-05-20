// TODO(cyrille): Update docker-react for ts format and separate dev_server config.
import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import getDevServer from './cfg/dev_server'
import configPromise from './cfg/webpack.config'

const host = process.env.BIND_HOST || 'localhost'

async function serve(): Promise<void> {
  const config = await configPromise
  const devServer = await getDevServer()
  new WebpackDevServer(webpack(config), devServer).
    listen(devServer.port, host, (err?: Error) => {
      if (err) {
        console.log(err) // eslint-disable-line no-console
      }
      console.log('Listening at ' + host + ':' + devServer.port) // eslint-disable-line no-console
    })
}

serve()
