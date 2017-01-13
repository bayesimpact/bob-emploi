'use strict'
require('es6-promise').polyfill()

var path = require('path')
var args = require('minimist')(process.argv.slice(2))

// List of allowed environments.
var allowedEnvs = ['dev', 'dist', 'test']

// Set the correct environment.
if(args._.length > 0 && args._.indexOf('start') !== -1) {
  process.env.REACT_WEBPACK_ENV = 'test'
} else if (!process.env.REACT_WEBPACK_ENV) {
  process.env.REACT_WEBPACK_ENV = 'dev'
}

// Get available configurations
var configs = {
  base: require(path.join(__dirname, 'cfg/base')),
  dev: require(path.join(__dirname, 'cfg/dev')),
  dist: require(path.join(__dirname, 'cfg/dist')),
  test: require(path.join(__dirname, 'cfg/test')),
}

/**
 * Get an allowed environment
 * @param  {String}  env
 * @return {String}
 */
function getValidEnv(env) {
  var isValid = env && env.length > 0 && allowedEnvs.indexOf(env) !== -1
  return isValid ? env : 'dev'
}

/**
 * Build the webpack configuration
 * @param  {String} env Environment to use
 * @return {Object} Webpack config
 */
function buildConfig(env) {
  var usedEnv = getValidEnv(env)
  return configs[usedEnv]
}

module.exports = buildConfig(process.env.REACT_WEBPACK_ENV)
