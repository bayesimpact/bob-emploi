/*eslint no-console:0 */
var webpack = require('webpack')
var WebpackDevServer = require('webpack-dev-server')
var config = require('./webpack.config')
var open = require('open')

new WebpackDevServer(webpack(config), config.devServer).
listen(config.port, config.host, function(err) {
  if (err) {
    console.log(err)
  }
  console.log('Listening at ' + config.host + ':' + config.port)
  console.log('Opening your system browser...')
  open('http://localhost:' + config.port + '/webpack-dev-server/')
})
