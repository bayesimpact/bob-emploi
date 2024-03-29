import {expect} from 'chai'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import JSON5 from 'json5'
import type {Plugin} from '../../cfg/plugins'
import getAllPlugins from '../../cfg/plugins'


interface Translations {
  [key: string]: string
}

interface TranslationFile {
  key: string
  lang?: string
  namespace: string
  // Core app is considered as a plugin named `core`.
  pluginName: string
  resources: Translations
}

interface TranslationTree {
  [pluginName: string]: {
    [lang: string]: {
      [namespace: string]: Translations
    }
  }
}

async function getPluginTranslationFiles({name: pluginName, pluginPath}: Plugin):
Promise<readonly TranslationFile[]> {
  const extractBaseFolder = path.join(pluginPath, 'i18n/extract')
  const extractJsonFilePaths = glob.sync(path.join(extractBaseFolder, '*.json'))
  const extractFiles = await Promise.all(
    extractJsonFilePaths.map(async (key: string): Promise<TranslationFile> => {
      const relativePath = path.relative(extractBaseFolder, key)
      const matches = relativePath.match(/^([^/]*)\.json/)
      if (!matches) {
        throw new Error(`${key} does not have a namespace in its path`)
      }
      const [namespace] = matches.slice(1)
      const importedModule = await import(key)
      return {
        key: relativePath,
        namespace,
        pluginName,
        resources: importedModule.default,
      }
    }),
  )

  if (!process.env.FAIL_ON_MISSING_TRANSLATIONS) {
    return extractFiles
  }

  const translationsBaseFolder = path.join(pluginPath, 'i18n/translations')
  const jsonFilePaths: readonly string[] = glob.sync(translationsBaseFolder + '/**/*.json')
  const translationsFiles = await Promise.all(
    jsonFilePaths.map(async (key: string): Promise<TranslationFile> => {
      const relativePath = path.relative(translationsBaseFolder, key)
      const matches = relativePath.match(/^([^/]*)\/([^/]*)\.json/)
      if (!matches) {
        throw new Error(`${key} does not have a namespace or a language in its path`)
      }
      const [lang, namespace] = matches.slice(1)
      const importedModule = await import(key)
      return {
        key: relativePath,
        lang,
        namespace,
        pluginName,
        resources: importedModule.default,
      }
    }),
  )

  return [...extractFiles, ...translationsFiles]
}

async function getAllTranslationFiles(): Promise<[readonly TranslationFile[], TranslationTree]> {
  const plugins = await getAllPlugins()
  const allPluginTranslationFiles = await Promise.all(plugins.map(getPluginTranslationFiles))
  const translationFiles: readonly TranslationFile[] = allPluginTranslationFiles.flat()

  const translationTree: TranslationTree = {}
  for (const {lang, namespace, pluginName, resources} of translationFiles) {
    if (!lang) {
      continue
    }
    translationTree[pluginName] = translationTree[pluginName] || {}
    translationTree[pluginName][lang] = translationTree[pluginName][lang] || {}
    translationTree[pluginName][lang][namespace] = resources
  }

  return [translationFiles, translationTree]
}


const airtableFields = JSON5.parse(
  fs.readFileSync(new URL('../../airtable_fields.json5', import.meta.url), 'utf-8'))
const airtableNamespaces = new Set(Object.keys(airtableFields))


const dropContext = (key: string): string => {
  const split = key.split('_')
  if (split.length === 1) {
    return key
  }
  return split.slice(0, -1).join('_')
}


const redactURLs = (value: string): string => {
  return value.replace(/\bhttps?:\/\/\S+\b/g, 'REDACTED_URL')
}


// The pattern of kebab-case identifiers, e.g. team:pascal:bio
const IDENTIFIER_PATTERN = /^[a-z][A-Za-z]*(:[A-Z_a-z-]+)+$/

const AUTHORIZED_EMPTY = new Set([
  // This option is unused in English.
  'CAP - BEP',
  // It's not necessary to have an equivalent for degree options.
  'Bac+2', 'Bac+3', 'Bac+5 et plus',
  // We don't have an equivalent of this video in English.
  'https://www.youtube.com/embed/mMBCNR9uIpE',
])

describe('Translation files', (): void => {
  let translationFiles: readonly TranslationFile[] = []
  let translationTree: TranslationTree = {}

  before(async () => {
    [translationFiles, translationTree] = await getAllTranslationFiles()

    const getExtractedFile = (file: TranslationFile): TranslationFile|undefined => {
      if (airtableNamespaces.has(file.namespace)) {
        return undefined
      }
      if (!file.lang) {
        return file
      }
      const extractedFile = translationFiles.find((otherFile) =>
        otherFile.pluginName === file.pluginName && otherFile.namespace === file.namespace &&
        !otherFile.lang)
      return extractedFile
    }

    for (const file of translationFiles) {
      const {lang, key: fileKey, namespace, pluginName, resources} = file
      describe(fileKey, (): void => {
        const extractedFile = getExtractedFile(file)
        const isAirtableNamespace = airtableNamespaces.has(namespace)

        for (const key in resources) {
          const resource = lang ? resources[key] : key
          const isIdentifier = IDENTIFIER_PATTERN.test(key)
          const canBeEmpty = AUTHORIZED_EMPTY.has(key)

          describe(resource, (): void => {
            it("should not contain the hardcoded product's name", (): void => {
              expect(resource).not.to.contain('Bob')
            })
            it('should not use curly quotes', (): void => {
              // eslint-disable-next-line unicorn/string-content
              expect(resource).not.to.contain('’')
            })
            it('should not use JSON5 control characters', (): void => {
              expect(resource, 'See https://spec.json5.org/#separators').
                not.to.match(/\u2028|\u2029/)
            })
            if (!lang) {
              if (!isAirtableNamespace) {
                const text = resources[key] || key
                if (!isIdentifier) {
                  it("should respect language's rule about blank spaces before punctuation", () => {
                    expect(
                      redactURLs(text),
                      'French double punctuation mark must be preceded by a non breakable space',
                    ).not.to.match(/[^!:?\u00A0][!:?]/)
                  })
                }
              }
              return
            }
            it('should not have empty translations', (): void => {
              if (!canBeEmpty) {
                expect(resource, key).not.to.be.empty
              }
            })
            it('should not need to translate to the same value as the key', () => {
              expect(resource, pluginName).not.to.equal(key)
            })
            if (extractedFile) {
              it('should not have non-extracted keys', () => {
                expect(key, `Unused key "${key}" in "${fileKey}"`).to.satisfy(
                  (key: string): boolean =>
                    extractedFile.resources[key] !== undefined ||
                    extractedFile.resources[dropContext(key)] !== undefined)
              })
            }
            it("should respect language's rule about blank spaces before punctuation", (): void => {
              if (!isAirtableNamespace && !isIdentifier) {
                expect(
                  redactURLs(key),
                  'French double punctuation mark must be preceded by a non breakable space').
                  not.to.match(/[^!:?\u00A0][!:?]/)
              }
              if (lang.replace(/@.*$/, '') === 'fr') {
                expect(
                  redactURLs(resource),
                  'French double punctuation mark must be preceded by a non breakable space').
                  not.to.match(/[^!:?\u00A0][!:?]/)
              } else if (lang === 'en') {
                expect(
                  resource, 'English double punctuation should not be preceded by a blank').
                  not.to.match(/[ \u00A0][!:?]/)
              }
            })
            if (isAirtableNamespace) {
              it('should not have beginning or trailing extra spaces', () => {
                expect(resource, `${key} should not have extra spaces at the beginning or end`).
                  not.to.match(/(^ | $)/g)
              })
            }
            if (namespace === 'categories') {
              it('should have the proper format', () => {
                expect(resource, `${key} should start with an uppercase letter`).
                  not.to.match(/^[a-z]/g)
                if (key.includes(':metric_details')) {
                  expect(resource, `${key} should end with a punctuation mark`).
                    to.match(/[!.?]$/g)
                }
              })
            } else if (namespace === 'adviceModules' && key.includes(':static_explanations')) {
              it('should have the proper format', () => {
                const explanations = resource.split('\n')
                for (const [line, explanation] of explanations.entries()) {
                  expect(
                    explanation,
                    `Key ${key} at line ${line} should not have extra spaces at the beginning or ` +
                    'end').
                    not.to.match(/(^ | $)/g)
                  expect(
                    explanation,
                    `Key ${key} at line ${line} should not start with an uppercase letter`).
                    not.to.match(/^[A-Z]/g)
                }
              })
            }
          })
        }
      })
    }
  })

  it('should be more than 3', (): void => {
    expect(translationFiles.length).to.be.greaterThan(3)
  })

  it('should have a known translation', function(): void {
    if (!process.env.FAIL_ON_MISSING_TRANSLATIONS) {
      this.skip()
      return
    }
    expect(translationTree['core']['en']['components']['Aide']).to.eq('Help')
  })
})

const _NO_FRENCH_PLURAL = new Set([
  'mois',
  'Recherche depuis {{count}} mois',
  '{{monthsAgo}} mois',
])

// TODO(cyrille) : Use a specific namespace for non-genderized strings
const _NO_GENDERIZATION = new Set([
  'find-what-you-like:bob_explanation',
  'missing-diploma:bob_explanation',
  'stuck-market:bob_explanation',
  'competition:text',
])

describe('French translations', () => {
  let translationFiles: readonly TranslationFile[] = []
  let translationTree: TranslationTree = {}
  before(async function(): Promise<void> {
    if (!process.env.FAIL_ON_MISSING_TRANSLATIONS) {
      this.skip()
    }
    [translationFiles, translationTree] = await getAllTranslationFiles()

    const extractedFiles = translationFiles.filter(file => !file.lang)
    for (const {pluginName, namespace, resources} of extractedFiles) {
      describe(`${pluginName}/fr/${namespace}.json`, () => {
        let frTranslations: Translations|undefined
        const getFrTranslations = (): Translations => {
          if (frTranslations) {
            return frTranslations
          }
          expect(translationTree).to.include.all.keys(pluginName)
          expect(translationTree[pluginName], 'Missing fr translations').
            to.include.all.keys('fr')
          expect(translationTree[pluginName]['fr'], 'Missing fr namespace translations').
            to.include.all.keys(namespace)
          const validFrTranslations = translationTree[pluginName]['fr'][namespace]
          frTranslations = validFrTranslations
          return validFrTranslations
        }

        if (namespace !== 'staticAdvice' && namespace !== 'landing') {
          it('should have a genderized translation for extracted strings with a ·', () => {
            const missingKeys: string[] = []
            for (const key in resources) {
              if (key.includes('·') && !key.endsWith('_FEMININE') && !key.endsWith('_MASCULINE') &&
                !_NO_GENDERIZATION.has(key)) {
                if (`${key}_FEMININE` in getFrTranslations() &&
                  `${key}_MASCULINE` in getFrTranslations()) {
                  continue
                }
                missingKeys.push(key)
              }
            }
            expect(missingKeys, 'Missing genderization for keys.').to.be.empty
          })
        }

        it('should have a plural translation for strings with an extracted plural', (): void => {
          for (const key in resources) {
            if (key.endsWith('_plural') && !_NO_FRENCH_PLURAL.has(key.slice(0, -7))) {
              expect(getFrTranslations()).to.include.keys(key)
            }
          }
        })
      })
    }

    const frTuFiles = translationFiles.filter(file => file.lang && file.lang.startsWith('fr'))
    for (const {pluginName, namespace, lang, resources} of frTuFiles) {
      describe(`${pluginName}/${lang}/${namespace}.json`, () => {
        if (namespace !== 'staticAdvice' && namespace !== 'landing') {
          it('should have a genderized translation for translated strings with a ·', () => {
            for (const key in resources) {
              if (resources[key].includes('·') && !key.endsWith('_FEMININE') &&
                !key.endsWith('_MASCULINE') && !_NO_GENDERIZATION.has(key)) {
                expect(resources, `Missing genderization for key ${key}.`).
                  to.include.all.keys(`${key}_FEMININE`, `${key}_MASCULINE`)
              }
            }
          })
        }
      })
    }
  })

  it('should have some French translations', (): void => {
    const extractedFiles = translationFiles.filter(file => !file.lang)
    expect(extractedFiles).not.to.be.empty
  })
})
