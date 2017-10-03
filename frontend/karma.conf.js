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
      type: 'html',
    },
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    },
    files: [
      'test/loadtests.js',
    ],
    frameworks: ['mocha', 'chai'],
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
