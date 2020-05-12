const {expect} = require('chai')
const _keyBy = require('lodash/keyBy')
const glob = require('glob')
const path = require('path')

interface Plugin {
  colors: {[name: string]: string}
  constants: {[name: string]: string}
  distConstants: {[name: string]: string}
  entrypoints: {[name: string]: {}}
  extractedLangs: ReadonlySet<string>
  isCore?: true
  name: string
  srcPath: string
}

const plugins: readonly Plugin[] = require('../../cfg/plugins')

const pluginByName = _keyBy(plugins, 'name')

interface Translations {
  [key: string]: string
}

interface TranslationFile {
  key: string
  lang: string
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

function getPluginTranslationFiles({name: pluginName, srcPath}: Plugin):
readonly TranslationFile[] {
  const baseFolder = path.join(srcPath, 'translations')
  const jsonFilePaths: readonly string[] = glob.sync(baseFolder + '/**/*.json')
  return jsonFilePaths.map((key: string): TranslationFile => {
    const relativePath = path.relative(baseFolder, key)
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
      resources: require(key),
    }
  })
}

function getAllTranslationFiles(): [readonly TranslationFile[], TranslationTree] {
  const translationFiles: TranslationFile[] = []
  plugins.forEach((plugin: Plugin) => {
    translationFiles.push(...getPluginTranslationFiles(plugin))
  })

  const translationTree: TranslationTree = {}
  translationFiles.forEach(({lang, namespace, pluginName, resources}): void => {
    translationTree[pluginName] = translationTree[pluginName] || {}
    translationTree[pluginName][lang] = translationTree[pluginName][lang] || {}
    translationTree[pluginName][lang][namespace] = resources
  })

  return [translationFiles, translationTree]
}
const [translationFiles, translationTree] = getAllTranslationFiles()


const IMPORTED_NAMESPACES = new Set([
  'adviceModules',
  'categories',
  'emailTemplates',
  'goals',
  'testimonials',
])

const isExtractedFile = (file: TranslationFile, keepImported = true): boolean => {
  if (IMPORTED_NAMESPACES.has(file.namespace)) {
    // Imported namepsaces do not follow the extraction pattern of babel-plugin-i18next-extract.
    return keepImported
  }
  const {extractedLangs} = pluginByName[file.pluginName]
  return extractedLangs.has(file.lang)
}

const getExtractedFile = (file: TranslationFile, keepImported = true): TranslationFile => {
  if (isExtractedFile(file, keepImported)) {
    return file
  }
  const defaultLangFile = translationFiles.find((otherFile) =>
    otherFile.pluginName === file.pluginName && otherFile.namespace === file.namespace &&
      isExtractedFile(otherFile, keepImported))
  expect(defaultLangFile, `${file.pluginName} ${file.namespace}`).not.to.be.undefined
  if (!defaultLangFile) {
    throw new Error('the chai test above should have failed')
  }
  return defaultLangFile
}


const dropContext = (key: string): string => {
  const split = key.split('_')
  if (split.length === 1) {
    return key
  }
  return split.slice(0, -1).join('_')
}


describe('Translation files', (): void => {
  it('should be more than 3', (): void => {
    expect(translationFiles.length).to.be.greaterThan(3)
  })

  translationFiles.forEach((file: TranslationFile): void => {
    describe(file.key, (): void => {
      it('should not have empty translations', (): void => {
        for (const key in file.resources) {
          expect(file.resources[key], key).not.to.be.empty
        }
      })

      it("should not contain the hardcoded product's name", (): void => {
        for (const key in file.resources) {
          expect(key).not.to.contain('Bob')
          expect(file.resources[key]).not.to.contain('Bob')
        }
      })

      if (!isExtractedFile(file)) {
        it('should not need to translate to the same value as the key', () => {
          for (const key in file.resources) {
            expect(file.resources[key], file.pluginName).not.to.equal(key)
          }
        })

        it('should not have non-extracted keys', () => {
          const extractedFile = getExtractedFile(file)
          for (const key in file.resources) {
            expect(key, `Unused key "${key}" in "${file.key}"`).
              to.satisfy((key: string): boolean => !!extractedFile.resources[dropContext(key)])
          }
        })
      }

      it("should respect language's rule about blank spaces before punctuation", (): void => {
        for (const key in file.resources) {
          expect(key, 'French double punctuation mark must be preceded by a non breakable space').
            not.to.match(/[^!:?\u00A0](?!:\/\/)[!:?]/)
          if (file.lang.replace(/@.*$/, '') === 'fr') {
            expect(
              file.resources[key],
              'French double punctuation mark must be preceded by a non breakable space').
              not.to.match(/[^!:?\u00A0](?!:\/\/)[!:?]/)
          } else if (file.lang === 'en') {
            expect(
              file.resources[key], 'English double punctuation should not be preceded by a blank').
              not.to.match(/[ \u00A0][!:?]/)
          }
        }
      })
    })
  })

  it('should have a known translation', (): void => {
    expect(translationTree['core']['en']['translation']['Aide']).to.eq('Help')
  })
})

const _NO_FRENCH_PLURAL = new Set([
  '{{monthsAgo}} mois',
  'mois',
])

const _NO_GENDERIZATION = new Set([
  'Ingénieur·e logiciel',
  // eslint-disable-next-line max-len
  "Quand je vous ai envoyé mon CV et ma lettre de motivation, il y a 2 semaines, l'épidémie de Coronavirus était encore loin de nos préoccupations immédiates. Aujourd'hui c'est bien différent et pourtant je crois que votre besoin d'un·e (nom du poste) est toujours présent, c'est pourquoi je me permets de vous relancer afin de connaître l'actualité de cette offre.",
  // eslint-disable-next-line max-len
  "Si vous touchez l'allocation chômage de Pôle emploi, ces derniers ont annulé toutes les convocations et vous ne serez donc pas radié·e pour non-présentation. <1>Les agent·e·s de Pôle emploi se mobilisent</1> et sont disponibles par téléphone au 3949 ou sur leur site internet.",
  // eslint-disable-next-line max-len
  "Sil a fait de la recherche académique et s'est spécialisé·e dans l'analyse     de données dans le domaine de la santé. Iel est toujours enchanté·e de découvrir d'obscurs     romans dystopiques et ne refusera jamais une rencontre sur un terrain de basket-ball.",
])

describe('French translations', (): void => {
  // Assumes all strings have been extracted, e.g. if lint_and_test.sh is run.
  // TODO(cyrille): Handle fr@tu.
  const extractedFiles = translationFiles.filter(file => isExtractedFile(file, false))
  extractedFiles.forEach(({pluginName, namespace, resources}): void => {
    describe(`${pluginName}/fr/${namespace}.json`, () => {

      const getFrTranslations = (): Translations => {
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

      it('should have a plural translation for all strings with an extracted plural', (): void => {
        for (const key in resources) {
          if (key.endsWith('_plural') && !_NO_FRENCH_PLURAL.has(key.slice(0, -7))) {
            expect(getFrTranslations()).to.include.keys(key)
          }
        }
      })
    })
  })
})

export {}
