import {expect} from 'chai'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import JSON5 from 'json5'
import getAllPlugins, {Plugin} from '../../cfg/plugins'


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
      return {
        key: relativePath,
        namespace,
        pluginName,
        resources: (await import(key)).default,
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
      return {
        key: relativePath,
        lang,
        namespace,
        pluginName,
        resources: (await import(key)).default,
      }
    }),
  )

  return [...extractFiles, ...translationsFiles]
}

async function getAllTranslationFiles(): Promise<[readonly TranslationFile[], TranslationTree]> {
  const plugins = await getAllPlugins()
  const translationFiles: readonly TranslationFile[] =
    (await Promise.all(plugins.map(getPluginTranslationFiles))).flat()

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
        it("should not contain the hardcoded product's name", (): void => {
          for (const key in resources) {
            if (lang) {
              expect(resources[key]).not.to.contain('Bob')
            } else {
              expect(key).not.to.contain('Bob')
            }
          }
        })

        it('should not use curly quotes', (): void => {
          for (const key in resources) {
            if (lang) {
              // eslint-disable-next-line unicorn/string-content
              expect(resources[key]).not.to.contain('’')
            } else {
              // eslint-disable-next-line unicorn/string-content
              expect(key).not.to.contain('’')
            }
          }
        })

        it('should not use JSON5 control characters', (): void => {
          for (const key in resources) {
            if (lang) {
              expect(resources[key], 'See https://spec.json5.org/#separators').
                not.to.match(/\u2028|\u2029/)
            } else {
              expect(key, 'See https://spec.json5.org/#separators').
                not.to.match(/\u2028|\u2029/)
            }
          }
        })

        if (!lang) {
          if (!airtableNamespaces.has(namespace)) {
            it("should respect language's rule about blank spaces before punctuation", (): void => {
              for (const [key, defaultValue] of Object.entries(resources)) {
                const text = defaultValue || key
                expect(
                  text, 'French double punctuation mark must be preceded by a non breakable space').
                  not.to.match(/[^!:?\u00A0](?!:\/\/)[!:?]/)
              }
            })
          }
          return
        }

        it('should not have empty translations', (): void => {
          for (const key in resources) {
            if (!AUTHORIZED_EMPTY.has(key)) {
              expect(resources[key], key).not.to.be.empty
            }
          }
        })

        it('should not need to translate to the same value as the key', () => {
          for (const key in resources) {
            expect(resources[key], pluginName).not.to.equal(key)
          }
        })

        const extractedFile = getExtractedFile(file)
        if (extractedFile) {
          it('should not have non-extracted keys', () => {
            for (const key in resources) {
              expect(key, `Unused key "${key}" in "${fileKey}"`).to.satisfy(
                (key: string): boolean =>
                  extractedFile.resources[key] === '' ||
                  extractedFile.resources[dropContext(key)] === '')
            }
          })
        }

        it("should respect language's rule about blank spaces before punctuation", (): void => {
          for (const key in resources) {
            if (!airtableNamespaces.has(namespace)) {
              expect(
                key, 'French double punctuation mark must be preceded by a non breakable space').
                not.to.match(/[^!:?\u00A0](?!:\/\/)[!:?]/)
            }
            if (lang.replace(/@.*$/, '') === 'fr') {
              expect(
                resources[key],
                'French double punctuation mark must be preceded by a non breakable space').
                not.to.match(/[^!:?\u00A0](?!:\/\/)[!:?]/)
            } else if (lang === 'en') {
              expect(
                resources[key], 'English double punctuation should not be preceded by a blank').
                not.to.match(/[ \u00A0][!:?]/)
            }
          }
        })

        if (airtableNamespaces.has(namespace)) {
          it('should not have beginning or trailing extra spaces', () => {
            for (const key in resources) {
              const value = resources[key]
              expect(value, `${key} should not have extra spaces at the beginning or end`).
                not.to.match(/(^ | $)/g)
            }
          })
        }

        if (namespace === 'categories') {
          it('should have the proper format', () => {
            for (const key in resources) {
              const value = resources[key]
              expect(value, `${key} should start with an uppercase letter`).
                not.to.match(/^[a-z]/g)
              if (key.includes(':metric_details')) {
                expect(value, `${key} should end with a punctuation mark`).
                  to.match(/[!.?]$/g)
              }
            }
          })
        } else if (namespace === 'adviceModules') {
          it('should have the proper format', () => {
            for (const key in resources) {
              if (!key.includes(':static_explanations')) {
                continue
              }
              const explanations = resources[key].split('\n')
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
    expect(translationTree['core']['en']['translation']['Aide']).to.eq('Help')
  })
})

const _NO_FRENCH_PLURAL = new Set([
  'mois',
  'Recherche depuis {{count}} mois',
  '{{monthsAgo}} mois',
])

// TODO(cyrille) : Use a specific namespace for non-genderized strings
const _NO_GENDERIZATION = new Set([
  'Ingénieur·e logiciel',
  // eslint-disable-next-line max-len
  "Quand je vous ai envoyé mon CV et ma lettre de motivation, il y a 2 semaines, l'épidémie de Coronavirus était encore loin de nos préoccupations immédiates. Aujourd'hui c'est bien différent et pourtant je crois que votre besoin d'un·e (nom du poste) est toujours présent, c'est pourquoi je me permets de vous relancer afin de connaître l'actualité de cette offre.",
  // eslint-disable-next-line max-len
  "Si vous touchez l'allocation chômage de Pôle emploi, ces derniers ont annulé toutes les convocations et vous ne serez donc pas radié·e pour non-présentation. <1>Les agent·e·s de Pôle emploi se mobilisent</1> et sont disponibles par téléphone au 3949 ou sur leur site internet. ",
  // eslint-disable-next-line max-len
  "Sil a fait de la recherche académique et s'est spécialisé·e dans l'analyse     de données dans le domaine de la santé. Iel est toujours enchanté·e de découvrir d'obscurs     romans dystopiques et ne refusera jamais une rencontre sur un terrain de basket-ball.",
  // eslint-disable-next-line max-len
  "Dans toutes vos communications \"emploi\"&nbsp;: candidature spontanée, lettre de motivation, email de relance, il est toujours important de personnaliser chaque message pour avoir plus de chance de toucher son destinataire. En ces temps incertains, il est tout aussi important d'adapter vos formulations en prenant en compte à la fois la situation générale mais également la situation de votre interlocuteur. N'hésitez pas à vous tenir informé·e de la situation de l'entreprise dans laquelle vous candidatez en surveillant ses réseaux sociaux.",
])

describe('French translations', () => {
  let translationFiles: readonly TranslationFile[] = []
  let translationTree: TranslationTree = {}
  before(async function(): Promise<void> {
    if (!process.env.FAIL_ON_MISSING_TRANSLATIONS) {
      this.skip()
    }
    [translationFiles, translationTree] = await getAllTranslationFiles()

    // TODO(cyrille): Handle fr@tu.
    const extractedFiles = translationFiles.filter(file => !file.lang)
    for (const {pluginName, namespace, resources} of extractedFiles) {
      describe(`${pluginName}/fr/${namespace}.json`, () => {
        const getFrTranslations = (): Translations => {
          expect(translationTree).to.include.all.keys(pluginName)
          expect(translationTree[pluginName], 'Missing fr translations').
            to.include.all.keys('fr')
          expect(translationTree[pluginName]['fr'], 'Missing fr namespace translations').
            to.include.all.keys(namespace)
          return translationTree[pluginName]['fr'][namespace]
        }

        if (namespace !== 'staticAdvice') {
          it('should have a genderized translation for all strings with a ·', () => {
            for (const key in resources) {
              if (key.includes('·') && !key.endsWith('_FEMININE') && !key.endsWith('_MASCULINE') &&
                !_NO_GENDERIZATION.has(key)) {
                expect(getFrTranslations(), `Missing genderization for key ${key}.`).
                  to.include.all.keys(`${key}_FEMININE`, `${key}_MASCULINE`)
              }
            }
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
  })

  it('should have some French translations', (): void => {
    const extractedFiles = translationFiles.filter(file => !file.lang)
    expect(extractedFiles).not.to.be.empty
  })
})
