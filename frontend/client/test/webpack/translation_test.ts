import {expect} from 'chai'

interface Translations {
  [key: string]: string
}

interface TranslationFile {
  folder: string
  key: string
  lang: string
  namespace: string
  resources: Translations
}

interface TranslationTree {
  [folder: string]: {
    [lang: string]: {
      [namespace: string]: Translations
    }
  }
}

function getAllTranslationFiles(): [readonly TranslationFile[], TranslationTree] {
  const translationContexts = require.context('translations', true, /\.json$/)
  const translationFiles: readonly TranslationFile[] = translationContexts.keys().map(
    (key: string): TranslationFile => {
      const matches = key.match(/^.\/(.*\/)?([^/]*)\/([^/]*)\.json/)
      if (!matches) {
        throw new Error(`${key} does not have a namespace or a language in its path`)
      }
      return {
        folder: matches[1]?.slice(0, -1) || '',
        key,
        lang: matches[2],
        namespace: matches[3],
        resources: translationContexts(key),
      }
    })

  const translationTree: TranslationTree = {}
  translationFiles.forEach(({folder, lang, namespace, resources}): void => {
    translationTree[folder] = translationTree[folder] || {}
    translationTree[folder][lang] = translationTree[folder][lang] || {}
    translationTree[folder][lang][namespace] = resources
  })

  return [translationFiles, translationTree]
}
const [translationFiles, translationTree] = getAllTranslationFiles()


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

      it('should not need to translate to the same value as the key', (): void => {
        if (file.lang === 'en') {
          // en is the extraction language, it must keep all keys.
          return
        }
        for (const key in file.resources) {
          expect(file.resources[key], file.folder).not.to.equal(key)
        }
      })

      it("should respect language's rule about blank spaces before punctuation", (): void => {
        for (const key in file.resources) {
          expect(key, 'French double punctuation mark must be preceded by a non breakable space').
            not.to.match(/[^!:?\u00A0][!:?]/)
          if (file.lang.replace(/@.*$/, '') === 'fr') {
            expect(
              file.resources[key],
              'French double punctuation mark must be preceded by a non breakable space').
              not.to.match(/[^!:?\u00A0][!:?]/)
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
    expect(translationTree['']['en']['translation']['Aide']).to.eq('Help')
  })
})

const _NO_FRENCH_PLURAL = new Set([
  '{{monthsAgo}} mois',
])

describe('French translations', (): void => {
  // Assumes all strings have been extracted to enTranslations, e.g. if lint_and_test.sh is run.
  const enTranslationFiles = translationFiles.filter(({lang}): boolean => lang === 'en')
  enTranslationFiles.forEach((file: TranslationFile): void => {
    describe(`${file.folder}fr/${file.namespace}.json`, (): void => {

      const getFrTranslations = (): Translations => {
        expect(translationTree[file.folder], 'Missing fr translations').
          to.include.all.keys('fr')
        expect(translationTree[file.folder]['fr'], 'Missing fr namespace translations').
          to.include.all.keys(file.namespace)
        return translationTree[file.folder]['fr'][file.namespace]
      }

      if (file.namespace !== 'staticAdvice') {
        it('should have a genderized translation for all strings with a ·', (): void => {
          for (const key in file.resources) {
            if (key.includes('·') && !key.endsWith('_FEMININE') && !key.endsWith('_MASCULINE')) {
              expect(getFrTranslations(), `Missing genderization for key ${key}.`).
                to.include.all.keys(`${key}_FEMININE`, `${key}_MASCULINE`)
            }
          }
        })
      }

      it('should have a plural translation for all strings with an English plural', (): void => {
        for (const key in file.resources) {
          if (key.endsWith('_plural') && !_NO_FRENCH_PLURAL.has(key.slice(0, -7))) {
            expect(getFrTranslations()).to.include.keys(key)
          }
        }
      })
    })
  })
})
