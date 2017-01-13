var webpackCfg = require('./webpack.config')

module.exports = function(config) {
  config.set({
    basePath: '',
    browsers: ['PhantomJS'],
    captureTimeout: 60000,
    client: {
      mocha: {},
    },
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
