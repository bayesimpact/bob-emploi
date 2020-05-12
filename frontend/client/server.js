// TODO(cyrille): Update docker-react.
var webpack = require('webpack')
var WebpackDevServer = require('webpack-dev-server')

var config = require('./webpack.config')
const devServer = require('./cfg/dev_server')

const host = process.env.BIND_HOST || 'localhost'

new WebpackDevServer(webpack(config), devServer).
  listen(devServer.port, host, function(err) {
    if (err) {
      console.log(err) // eslint-disable-line no-console
    }
    console.log('Listening at ' + host + ':' + devServer.port) // eslint-disable-line no-console
  })
