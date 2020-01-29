var webpackCfg = require('./webpack.config')

process.env.CHROME_BIN = require('puppeteer').executablePath()

module.exports = function(config) {
  const clientConfig = {
    captureConsole: false,
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
      'src/store/*.ts',
      'test/webpack/loadtests.ts',
    ],
    frameworks: ['mocha', 'chai'],
    port: 8080,
    preprocessors: {
      'src/store/*.ts': ['webpack', 'sourcemap', 'coverage'],
      'test/webpack/loadtests.ts': ['webpack', 'sourcemap'],
    },
    reporters: ['mocha', 'coverage'],
    singleRun: true,
    webpack: webpackCfg,
    webpackServer: {
      noInfo: true,
    },
  })
}
