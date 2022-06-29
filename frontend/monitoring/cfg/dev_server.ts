import {existsSync, readFileSync} from 'fs'
import path from 'path'
import type {Configuration} from 'webpack-dev-server'


const sslPath = '/etc/ssl/webpack-dev'

export default {
  client: {
    webSocketURL: `https://${process.env.PUBLIC_HOST}:${process.env.PUBLIC_PORT}`,
  },
  host: process.env.BIND_HOST || 'localhost',
  https: existsSync(path.join(sslPath, 'key.pem')) ? {
    cacert: readFileSync(path.join(sslPath, 'chain.pem')),
    cert: readFileSync(path.join(sslPath, 'cert.pem')),
    key: readFileSync(path.join(sslPath, 'key.pem')),
  } : false,
  port: 80,
} as Configuration
