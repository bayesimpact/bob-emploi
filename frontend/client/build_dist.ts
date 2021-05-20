import webpack from 'webpack'
import getAllConfigs from './cfg/dist'

/* eslint-disable no-console */

async function runAllConfig(): Promise<void> {
  const configs = await getAllConfigs()
  for (const config of configs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      webpack(config).run((err, stats) => {
        if (err) {
          reject(err)
        }
        if (stats) {
          console.log(stats.toString())
          if (stats.hasErrors()) {
            reject(stats.compilation.errors[0])
          }
        }
        resolve(stats)
      })
    })
  }
}

runAllConfig()
