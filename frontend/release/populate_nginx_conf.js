const fs = require('fs')
const path = require('path')

const plugins = require('../client/cfg/plugins')

const template = fs.readFileSync(path.join(__dirname, 'nginx_template.conf'), 'utf-8')
const locations = []

plugins.forEach(({entrypoints}) =>
  Object.values(entrypoints).forEach(({htmlFilename, prefixes}) =>
    prefixes && prefixes.forEach(prefix => {
      locations.push({htmlFilename, prefix})
    })))

const locationStrings = locations.map(({htmlFilename, prefix}) =>
  `location ${prefix} {
    try_files $uri /${htmlFilename};
  }`)
const fullConf = template.replace(
  '# ADD SPECIFIC LOCATIONS CONFIG HERE',
  locationStrings.join('\n\n  '),
)
fs.writeFile(process.argv[2], fullConf, () => void 0)
