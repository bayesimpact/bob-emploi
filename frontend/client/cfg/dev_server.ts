import {existsSync} from 'fs'
import type {ServerOptions} from 'https'
import path from 'path'
import type {Configuration} from 'webpack-dev-server'
import type {Rewrite} from 'connect-history-api-fallback'

import getPlugins, {getEntrypoints} from './plugins'

type ConfigWithRewrites = Configuration & {historyApiFallback: {
  rewrites: (Rewrite & {to: string})[]
}}

async function getDevServer(): Promise<ConfigWithRewrites> {
  const pluginEntries = getEntrypoints(await getPlugins())
  const rewrites = pluginEntries.map(({htmlFilename, prefix}) => ({
    from: prefix ? new RegExp(`^${prefix}(/|$)`) : /.*/,
    to: `/${htmlFilename}`,
  }))

  const sslPath = '/etc/ssl/webpack-dev'
  return {
    client: {
      webSocketURL: `https://${process.env.PUBLIC_HOST}:${process.env.PUBLIC_PORT}/ws`,
    },
    historyApiFallback: {rewrites},
    host: process.env.BIND_HOST || 'localhost',
    port: 80,
    proxy: {
      '/api': {
        secure: false,
        target: 'https://frontend-flask',
      },
    },
    server: existsSync(path.join(sslPath, 'key.pem')) ? {
      options: {
        ca: path.join(sslPath, 'chain.pem'),
        cert: path.join(sslPath, 'cert.pem'),
        key: path.join(sslPath, 'key.pem'),
      } as ServerOptions,
      type: 'https',
    } : 'http',
  }
}

export default getDevServer
