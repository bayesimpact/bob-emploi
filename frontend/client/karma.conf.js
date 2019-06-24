var webpackCfg = require('./webpack.config')

process.env.CHROME_BIN = require('puppeteer').executablePath()

module.exports = function(config) {
  const clientConfig = {
    mocha: {},
  }
  if (config.grep) {
    clientConfig.args = ['--grep', config.grep]
  }
  config.set({
    basePath: '',
    browsers: ['ChromeHeadlessNoSandbox'],
    captureTimeout: 60000,
    client: clientConfig,
    coverageReporter: {
      dir: 'coverage/',
      subdir: '.',
      type: 'lcov',
    },
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    },
    files: [
      'src/store/*.js',
      'test/webpack/loadtests.js',
    ],
    frameworks: ['mocha', 'chai'],
    port: 8080,
    preprocessors: {
      'src/store/*.js': ['webpack', 'sourcemap', 'coverage'],
      'test/webpack/loadtests.js': ['webpack', 'sourcemap'],
    },
    reporters: ['mocha', 'progress', 'coverage'],
    singleRun: true,
    webpack: webpackCfg,
    webpackServer: {
      noInfo: true,
    },
  })
}
