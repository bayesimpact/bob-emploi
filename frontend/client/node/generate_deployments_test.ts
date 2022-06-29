/* Generate a file to test deployment types.
 *
 * This files looks like the following:
 *
 * import press from 'deployment/press'
 * import pressFr from 'deployment/../fr/press'
 * import pressUk from 'deployment/../uk/press'
 * ... // Same for all deployments in cfg/deployments
 *
 * ... // Same for all files with a d.ts file in src/deployment
 *
 * const checkSameType<T>(unusedType: T, unusedDeployed: T): boolean => true
 *
 * checkSameType(press, pressFr)
 * checkSameType(press, pressUk)
 * ... // Same for all deployments
 *
 * ... // Same for all files
 */

import {promises as fs} from 'fs'
import glob from 'glob'
import path from 'path'
import {fileURLToPath} from 'url'

const DEPLOYMENTS_FOLDER = fileURLToPath(new URL('../cfg/deployments', import.meta.url))
const DEPLOYMENT_FILES_FOLDER = fileURLToPath(new URL('../src/deployments', import.meta.url))


const globPromise = (pattern: string): Promise<readonly string[]> =>
  new Promise((resolve, reject) => {
    glob(pattern, (err, files) => err ? reject(err) : resolve(files))
  })

const toCamelCase = (name: string): string => name.
  split('_').
  map((word, index) => index && word ? word[0].toUpperCase() + word.slice(1) : word).
  join('')

// List all deployment files.
const getAllDeployments = async (deploymentFolder: string): Promise<readonly string[]> => {
  const deploymentFiles = await globPromise(`${deploymentFolder}/*.json5`)
  return deploymentFiles.map(filepath => path.basename(filepath, '.json5'))
}

interface TypeFile {
  isDefaultExported: boolean
  name: string
}

// List all typed files.
const getAllTypes = async (deploymentFilesFolder: string): Promise<readonly TypeFile[]> => {
  const typesFolder = `${deploymentFilesFolder}/types/`
  const filenames = await globPromise(`${typesFolder}*.d.ts`)
  return Promise.all(filenames.map(async (filename) => {
    const contentAsBytes = await fs.readFile(filename)
    const content = contentAsBytes.toString()
    return {
      isDefaultExported: content.includes('export default'),
      name: path.basename(filename, '.d.ts'),
    }
  }))
}

const makeFilename = (typename: string, deployment?: string): string =>
  toCamelCase(`${typename}_${deployment || ''}`)


const makeImportsForFile = ({name, isDefaultExported}: TypeFile, deployments: readonly string[])
: readonly string[] => {
  const importMode = isDefaultExported ? '' : '* as '
  return [
    `import ${importMode}${makeFilename(name)} from 'deployment/${name}'`,
    ...deployments.map(dep =>
      `import ${importMode}${makeFilename(name, dep)} from 'deployment/../${dep}/${name}'`),
    '',
  ]
}

const makeChecksForFile = (name: string, deployments: readonly string[]): readonly string[] => [
  ...deployments.map(dep => `checkSameType(${makeFilename(name)}, ${makeFilename(name, dep)})`),
  '',
]

// Generate all lines for the generated file.
const makeFile = (deployments: readonly string[], types: readonly TypeFile[]): string =>
  [
    ...types.flatMap(type => makeImportsForFile(type, deployments)),
    'const checkSameType = <T>(unusedTypes: T, unusedDeployed: T): boolean => true', '',
    ...types.flatMap(type => makeChecksForFile(type.name, deployments)),
  ].join('\n')

export default async (outputFile: string): Promise<void> => {
  return fs.writeFile(outputFile, makeFile(
    await getAllDeployments(DEPLOYMENTS_FOLDER), await getAllTypes(DEPLOYMENT_FILES_FOLDER)))
}
