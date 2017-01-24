/*eslint no-console:0 */
var webpack = require('webpack')
var WebpackDevServer = require('webpack-dev-server')
var config = require('./webpack.config')
var open = require('open')

const host = process.env.BIND_HOST || 'localhost'

new WebpackDevServer(webpack(config), config.devServer).
listen(config.devServer.port, host, function(err) {
  if (err) {
    console.log(err)
  }
  console.log('Listening at ' + host + ':' + config.devServer.port)
  console.log('Opening your system browser...')
  open('http://localhost:' + config.devServer.port + '/webpack-dev-server/')
})
