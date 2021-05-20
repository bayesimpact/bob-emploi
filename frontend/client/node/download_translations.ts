import Airtable from 'airtable'
import {promises as fs} from 'fs'
import path from 'path'
import _keyBy from 'lodash/keyBy'
import _pickBy from 'lodash/pickBy'
import stringify from 'json-stable-stringify'
import {fileURLToPath} from 'url'

/* eslint-disable no-console */

const isDryRun = !!process.env.DRY_RUN
const skipMissingTranslations = !process.env.FAIL_ON_MISSING_TRANSLATIONS

const raiseForMissingKey = (key: string): void => {
  const err = `Missing a translation for ${key}`
  console.log(err)
  if (!skipMissingTranslations && !isDryRun) {
    throw new Error(err)
  }
}

interface Translation {
  readonly string: string
  readonly [lang: string]: string
}

interface TranslationDict {
  [key: string]: Translation
}

interface ContextDict {
  readonly [key: string]: readonly string[]
}

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
  async function contextsGetter(): Promise<ContextDict> {
    const translations = await getTranslations()
    const contextDict: {[key: string]: string[]} = {}
    for (const key of Object.keys(translations)) {
      const parts = key.split('_')
      for (const [index] of parts.entries()) {
        if (!index) {
          continue
        }
        const key = parts.slice(0, index).join('_')
        const contextDictKey = contextDict[key] || []
        contextDict[key] = contextDictKey
        for (const [splitIndex] of parts.entries()) {
          if (splitIndex < index) {
            continue
          }
          contextDictKey.push(parts.slice(0, splitIndex + 1).join('_'))
        }
      }
    }
    return contextDict
  }
  const futureContexts = contextsGetter()
  contextsCache = futureContexts
  return futureContexts
}

function resetCache(): void {
  contextsCache = undefined
  translationsCache = undefined
}


const AUTHORIZED_EMPTY = new Set([
  // This option is unused in English.
  'CAP - BEP',
  // It's not necessary to have an equivalent for degree options.
  'Bac+2', 'Bac+3', 'Bac+5 et plus',
  // We don't have an equivalent of this video in English.
  'https://www.youtube.com/embed/mMBCNR9uIpE',
])

async function translate(
  lang: string, strings: readonly string[], namespace: string,
): Promise<Record<string, string>> {
  const translations = await getTranslations()
  const allContexts = await getContexts()
  const translated: Record<string, string> = {}
  const namespacePrefix = namespace + ':'
  for (const key of strings) {
    const translationsForKey = translations[namespacePrefix + key] || translations[key]
    if (!translationsForKey) {
      if (AUTHORIZED_EMPTY.has(key)) {
        if (lang === 'en') {
          translated[key] = ''
        }
        continue
      }
      raiseForMissingKey(key)
      continue
    }
    const translatedKey = translationsForKey[lang] || ''
    if (translatedKey) {
      translated[key] = translatedKey
    }
    const contextsForKey = allContexts[namespacePrefix + key] || allContexts[key]
    if (contextsForKey) {
      for (const keyWithContext of contextsForKey) {
        const translationsForKeyWithContext = translations[keyWithContext]
        if (!translationsForKeyWithContext) {
          continue
        }
        const translatedKeyWithContext = translationsForKeyWithContext[lang] || ''
        if (translatedKeyWithContext) {
          if (keyWithContext.startsWith(namespacePrefix)) {
            translated[keyWithContext.slice(namespacePrefix.length)] = translatedKeyWithContext
          } else {
            translated[keyWithContext] = translatedKeyWithContext
          }
        }
      }
    }
  }
  return translated
}

async function ensureDirExists(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, {recursive: true})
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

async function translateNamespace(
  inputFile: string, namespace: string, outputFolder: string, languages: readonly string[],
): Promise<void> {
  const jsonContent = await fs.readFile(inputFile, {encoding: 'utf8'})
  const i18nextDict = JSON.parse(jsonContent)
  const translatedDicts = await Promise.all(
    languages.map(async (lang: string): Promise<[string, Record<string, string>]> =>
      [lang, await translate(lang, Object.keys(i18nextDict), namespace)]))
  const translatedDictsMap = Object.fromEntries(translatedDicts)

  // Drop the keys for which the translation is the same in a fallback language or key.
  for (const lang of [...languages].sort().reverse()) {
    const languageParts = lang.split(/[@_]/)
    const fallbackLang = languageParts[0]
    if (fallbackLang && languageParts.length > 1) {
      translatedDictsMap[lang] = _pickBy(
        translatedDictsMap[lang],
        (value: string, key: string) => (translatedDictsMap[fallbackLang][key] || key) !== value,
      )
    } else {
      translatedDictsMap[lang] = _pickBy(
        translatedDictsMap[lang],
        (value: string, key: string) => key !== value,
      )
    }
  }

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
