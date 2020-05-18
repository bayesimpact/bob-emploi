const fs = require('fs')
const path = require('path')

const plugins = require('./plugins')

// TODO(cyrille): Check that they aren't any same-name keys.
const entrypoints = plugins.reduce((previousEntrypoints, {entrypoints}) => ({
  ...previousEntrypoints,
  ...entrypoints,
}), {})

const sslPath = '/etc/ssl/webpack-dev'

module.exports = {
  contentBase: './',
  historyApiFallback: {
    rewrites: Object.values(entrypoints).
      filter(({rewrite}) => rewrite).
      map(({rewrite, htmlFilename}) => ({from: rewrite, to: `/${htmlFilename}`})),
  },
  hot: true,
  https: fs.existsSync(path.join(sslPath, 'key.pem')) ? {
    ca: fs.readFileSync(path.join(sslPath, 'chain.pem')),
    cert: fs.readFileSync(path.join(sslPath, 'cert.pem')),
    key: fs.readFileSync(path.join(sslPath, 'key.pem')),
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
