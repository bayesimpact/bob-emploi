import webpack from 'webpack'

import config from './cfg/webpack.config'

webpack(config).run((err, stats) => {
  if (err) {
    throw err
  }
  if (stats) {
    // eslint-disable-next-line no-console
    console.log(stats.toString())
    if (stats.hasErrors()) {
      throw stats.compilation.errors[0]
    }
  }
})
