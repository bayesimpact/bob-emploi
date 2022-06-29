// A script to extract all URLs used in our client code so that we can check that they are
// pointing to existing websites. See data_analysis/importer/maintenance.py to use the result.
import {spawnSync} from 'child_process'
import fs from 'fs'
import stringify from 'json-stable-stringify'
import {fileURLToPath} from 'url'

const urlPattern = /https?:[^ "',`]+/g

const throwError = (err: Error|null) => {
  if (err) {
    throw err
  }
}

function extractURLs(outputPath: string) {
  const grep = spawnSync(
    'grep', ['checkURL', '-I', '-r', '.'], {stdio: ['ignore', 'pipe', 'inherit']})
  const lines = grep.stdout.toString().split('\n')
  const urls = lines.flatMap(line => {
    if (!line.trim()) {
      return []
    }
    const [file, content] = line.split(':    ')
    if (!content) {
      return []
    }
    const urls = content.match(urlPattern)
    if (!urls) {
      return []
    }
    return urls.map(url => ({file, url}))
  })
  fs.writeFile(outputPath, stringify(urls, {space: 2}) + '\n', throwError)
  // eslint-disable-next-line no-console
  console.log(`${urls.length} URLs extracted to ${outputPath}.`)
}

function main() {
  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    extractURLs('/tmp/bob_emploi/extracted_urls.json')
  }
}

main()
