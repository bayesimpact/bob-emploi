/* Convert translation from Airtable format to i18next format without assuming any IO.
 *
 * TODO(cyrille): Use this in a Lambda to generate translation files on s3.
 */
import _pickBy from 'lodash/pickBy'

const raiseForMissingKey = (key: string, lang: string, shouldRaise = false): void => {
  const err = `Missing a translation for ${key} in ${lang}`
  // eslint-disable-next-line no-console
  console.log(err)
  if (shouldRaise) {
    throw new Error(err)
  }
}

export interface Translation {
  readonly [lang: string]: string
}

export interface TranslationDict {
  [key: string]: Translation
}

export interface ContextDict {
  readonly [key: string]: readonly string[]
}

// Get the mapping of translations to existing translations that looks like contexts.
// e.g. {"Parent": ["Parent_FEMININE", "Parent_MASCULINE"], "mois": ["mois_plural"]}
function aggregateContexts(translations: TranslationDict): ContextDict {
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

const AUTHORIZED_EMPTY = new Set([
  // This option is unused in English.
  'CAP - BEP',
  // It's not necessary to have an equivalent for degree options.
  'Bac+2', 'Bac+3', 'Bac+5 et plus',
  // We don't have an equivalent of this video in English.
  'https://www.youtube.com/embed/mMBCNR9uIpE',
])


function translate(
  lang: string, strings: readonly string[], namespace: string,
  translations: TranslationDict, allContexts: ContextDict,
  shouldRaise = false,
): Record<string, string> {
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
      raiseForMissingKey(key, lang, shouldRaise)
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

const translateNamespace = (
  i18nextDict: Record<string, string>, namespace: string, languages: readonly string[],
  translations: TranslationDict, allContexts: ContextDict, shouldRaise = false,
): Record<string, Record<string, string>> => {
  const translatedDicts = languages.map((lang: string): [string, Record<string, string>] =>
    [lang, translate(
      lang, Object.keys(i18nextDict), namespace,
      translations, allContexts, shouldRaise,
    )])
  const translatedDictsMap: Record<string, Record<string, string>> =
    Object.fromEntries(translatedDicts)

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
  return translatedDictsMap
}
export {aggregateContexts, translateNamespace}
