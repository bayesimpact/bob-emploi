var webpackCfg = require('./webpack.config')

module.exports = function(config) {
  const clientConfig = {
    mocha: {},
  }
  if (config.grep) {
    clientConfig.args = ['--grep', config.grep]
  }
  config.set({
    basePath: '',
    browsers: ['PhantomJS'],
    captureTimeout: 60000,
    client: clientConfig,
    coverageReporter: {
      dir: 'coverage/',
      type: 'html',
    },
    files: [
      'test/loadtests.js',
    ],
    frameworks: ['phantomjs-shim', 'mocha', 'chai'],
    port: 8080,
    preprocessors: {
      'test/loadtests.js': ['webpack', 'sourcemap'],
    },
    reporters: ['mocha', 'coverage'],
    singleRun: true,
    webpack: webpackCfg,
    webpackServer: {
      noInfo: true,
    },
  })
}
