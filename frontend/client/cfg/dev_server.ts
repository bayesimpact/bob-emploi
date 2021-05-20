import {promises as fs, existsSync} from 'fs'
import _flatMap from 'lodash/flatMap'
import path from 'path'

import getAllPlugins, {Entrypoint} from './plugins'

type EntrypointWithPrefixes = Entrypoint & {prefixes: NonNullable<Entrypoint['prefixes']>}

interface Rewrite {
  from: RegExp
  to: string
}

interface DevServer {
  contentBase: string
  historyApiFallback: {rewrites: readonly Rewrite[]}
  hot: boolean
  https: false | {
    ca: Buffer
    cert: Buffer
    key: Buffer
  }
  noInfo: boolean
  port: number
  proxy: {
    [prefix: string]: {
      secure: boolean
      target: string
    }
  }
  public: string
  publicPath: string
}

async function getDevServer(): Promise<DevServer> {
  const plugins = await getAllPlugins()
  const entrypoints: {[name: string]: Entrypoint} = plugins.
    reduce((previousEntrypoints, {entrypoints}) => ({
      ...previousEntrypoints,
      ...entrypoints,
    }), {})

  const sslPath = '/etc/ssl/webpack-dev'

  const rewrites: readonly Rewrite[] = _flatMap(Object.values(entrypoints).
    filter((e): e is EntrypointWithPrefixes => !!e.prefixes).
    map(({htmlFilename, prefixes}): readonly Rewrite[] => prefixes.map((prefix): Rewrite => ({
      from: new RegExp(`^${prefix}(/|$)`),
      to: `/${htmlFilename}`,
    }))))

  return {
    contentBase: './',
    historyApiFallback: {rewrites},
    hot: true,
    https: existsSync(path.join(sslPath, 'key.pem')) ? {
      ca: await fs.readFile(path.join(sslPath, 'chain.pem')),
      cert: await fs.readFile(path.join(sslPath, 'cert.pem')),
      key: await fs.readFile(path.join(sslPath, 'key.pem')),
    } : false,
    noInfo: false,
    port: 80,
    proxy: {
      '/api': {
        secure: false,
        target: 'https://frontend-flask',
      },
    },
    public: `${process.env.PUBLIC_HOST}:${process.env.PUBLIC_PORT}`,
    publicPath: '/',
  }
}

export default getDevServer
