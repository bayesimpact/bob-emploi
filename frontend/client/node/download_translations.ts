/*
 * Download translations from Airtable and save them into files, as expected by i18next.
 */
import Airtable from 'airtable'
import {promises as fs} from 'fs'
import path from 'path'
import _keyBy from 'lodash/keyBy'
import stringify from 'json-stable-stringify'
import {fileURLToPath} from 'url'

import type {ContextDict, Translation, TranslationDict} from './import_translations'
import {aggregateContexts,
  translateNamespace as syncTranslateNamespace} from './import_translations'
/* eslint-disable no-console */

const isDryRun = !!process.env.DRY_RUN
const skipMissingTranslations = !process.env.FAIL_ON_MISSING_TRANSLATIONS

let translationsCache: Promise<TranslationDict> | undefined

function getTranslations(): Promise<TranslationDict> {
  if (translationsCache) {
    return translationsCache
  }
  async function translationsGetter(): Promise<TranslationDict> {
    const translations = await new Airtable().base('appkEc8N0Bw4Uok43')('translations').
      select({view: 'viwLyQNlJtyD4l45k'}).all()
    return _keyBy(translations.map(record => record.fields as Translation), 'string')
  }
  const futureTranslations = translationsGetter()
  translationsCache = futureTranslations
  return futureTranslations
}

let contextsCache: Promise<ContextDict> | undefined

// Get the mapping of translations to existing translations that looks like contexts.
// e.g. {"Parent": ["Parent_FEMININE", "Parent_MASCULINE"], "mois": ["mois_plural"]}
function getContexts(): Promise<ContextDict> {
  if (contextsCache) {
    return contextsCache
  }
  const contextsGetter = async (): Promise<ContextDict> =>
    aggregateContexts(await getTranslations())
  const futureContexts = contextsGetter()
  contextsCache = futureContexts
  return futureContexts
}

function resetCache(): void {
  contextsCache = undefined
  translationsCache = undefined
}

async function ensureDirExists(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, {recursive: true})
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

async function translateNamespace(
  inputFile: string, namespace: string, outputFolder: string, languages: readonly string[],
): Promise<void> {
  const jsonContent = await fs.readFile(inputFile, {encoding: 'utf8'})
  const i18nextDict = JSON.parse(jsonContent)
  const translatedDictsMap = syncTranslateNamespace(
    i18nextDict, namespace, languages,
    await getTranslations(), await getContexts(),
    !skipMissingTranslations && !isDryRun,
  )

  if (isDryRun) {
    return
  }

  // Write the files.
  await Promise.all(languages.map(async (lang: string) => {
    const translatedDict = translatedDictsMap[lang] || {}
    if (!Object.keys(translatedDict).length) {
      return
    }
    console.log(`Writing translations for ${namespace} in ${lang}…`)
    await ensureDirExists(path.join(outputFolder, lang))
    await fs.writeFile(
      path.join(outputFolder, lang, namespace + '.json'),
      stringify(translatedDict, {space: 2}) + '\n',
    )
  }))
}

function translateAll(
  inputFolders: readonly string[], outputFolder: string, languages: readonly string[],
): Promise<unknown> {
  return Promise.all(inputFolders.map(async (inputFolder) => {
    const files = await fs.readdir(inputFolder)
    return Promise.all(files.filter(file => file.endsWith('.json')).map((file: string) =>
      translateNamespace(path.join(inputFolder, file), file.slice(0, -5), outputFolder, languages)))
  }))
}
translateAll.resetCache = resetCache


export default translateAll

async function translateAllAndLogError(
  inputFolders: readonly string[], outputFolder: string, languages: readonly string[],
): Promise<void> {
  try {
    await translateAll(inputFolders, outputFolder, languages)
  } catch (error) {
    console.log(error)
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  translateAllAndLogError(
    ['i18n/extract', 'src/translations/fr'],
    'i18n/translations',
    ['en', 'en_UK', 'fr', 'fr@tu'],
  )
}
