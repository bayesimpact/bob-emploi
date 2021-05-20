import {promises as fs} from 'fs'
import getAllDeployments from '../cfg/deployment'

async function populateNginxConf(outputPathFile: string): Promise<void> {
  const {demo: {plugins}} = await getAllDeployments()

  const template = await fs.readFile(new URL('nginx_template.conf', import.meta.url), 'utf-8')

  const locations = plugins.flatMap(({entrypoints}) =>
    Object.values(entrypoints).flatMap(({htmlFilename, prefixes}) =>
      htmlFilename && prefixes ? prefixes.map(prefix => ({htmlFilename, prefix})) : []))

  const locationStrings = locations.map(({htmlFilename, prefix}) =>
    `location ${prefix} {
      try_files $uri /${htmlFilename};
    }`)
  const fullConf = template.replace(
    '# ADD SPECIFIC LOCATIONS CONFIG HERE',
    locationStrings.join('\n\n  '),
  )
  await fs.writeFile(outputPathFile, fullConf)
}

populateNginxConf(process.argv[2])
