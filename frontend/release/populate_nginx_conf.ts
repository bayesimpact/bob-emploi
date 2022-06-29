import path from 'path'
import {promises as fs} from 'fs'
import {getDistDeployments} from '../cfg/deployment'
import {getEntrypoints} from '../cfg/plugins'

async function populateNginxConf(outputPath: string): Promise<void> {
  const deployments = await getDistDeployments(process.env.BOB_DEPLOYMENTS)
  const template = await fs.readFile(new URL('nginx_template.conf', import.meta.url), 'utf8')

  await deployments.map(async deployment => {
    const {name, plugins} = deployment

    // TODO(cyrille): Add favicon redirection depending on referer and plugin.
    // See https://stackoverflow.com/questions/53718930/conditional-routing-with-nginx-based-on-referer/53722774
    const locationStrings = getEntrypoints(plugins).map(({htmlFilename, prefix}) =>
      `location ${prefix || '/'} {
        gzip on;
        gzip_static on;
        gzip_types application/javascript text/html;
        try_files $uri /${htmlFilename};
      }`)

    const fullConf = template.
      replace(
        '# ADD SPECIFIC LOCATIONS CONFIG HERE',
        locationStrings.join('\n\n  '),
      ).
      replace('$deploymentName', name)
    await fs.writeFile(path.join(outputPath, `${name}.conf`), fullConf)
  })
}

populateNginxConf(process.argv[2])
