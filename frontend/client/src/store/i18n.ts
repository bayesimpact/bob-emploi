import * as Sentry from '@sentry/browser'
import type {InitOptions, ReadCallback, ResourceKey, Services, TFunction, TOptions,
  i18n} from 'i18next'
import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import _mapValues from 'lodash/mapValues'
import _pick from 'lodash/pick'
import {initReactI18next} from 'react-i18next'


// Backend for i18next to load resources for languages only when they are needed.
// It takes a backend config with a promise per language and per namespace.
class PromiseI18nBackend {
  public static type = 'backend' as const

  private importFunc: PromiseImportFunc|undefined

  public init(services: Services, backendOptions: PromiseImportFunc): void {
    this.importFunc = backendOptions
  }

  public async read(language: string, namespace: string, callback: ReadCallback): Promise<void> {
    if (!this.importFunc) {
      callback(null, {})
      return
    }
    try {
      const {default: resources} = await this.importFunc(language, namespace)
      callback(null, resources)
    } catch {
      callback(null, {})
    }
  }
}

// Plugin for i18next to teach about extra lang's plural.
const DialectI18nPlugin = {
  init: (i18next: i18n): void => {
    // TODO(pascal): Fix the languageUtils instead.
    i18next.services.pluralResolver.addRule(
      'fr@tu', i18next.services.pluralResolver.getRule('fr'))
    i18next.services.pluralResolver.addRule(
      'en_UK', i18next.services.pluralResolver.getRule('en-GB'))
  },
  type: '3rdParty',
} as const

const getFallbackLanguages = (lang: string): readonly string[] => {
  const langs: string[] = [lang]
  if (lang.includes('@')) {
    langs.push(lang.replace(/@.*$/, ''))
  }
  if (lang.includes('_')) {
    langs.push(lang.replace(/_.*$/, ''))
  }
  return langs
}

/* eslint-disable no-console */
const missingKeyHandler = (langs: readonly (string|undefined)[], ns: string, key: string): void => {
  for (const lang of langs) {
    if (!lang) {
      // TODO(pascal): Investigate why we get undefined (it looks like the i18next Translator can
      // be in a state where this.language is undefined).
      continue
    }
    const langNs = `${lang}/${ns}`
    // TODO(cyrille): Find a way to have missing contextual translations properly logged.
    if (key.includes('_')) {
      const [keyRoot, context] = key.split('_')
      context && keyRoot &&
        console.log(`Missing ${context.toLowerCase()} translation in ${langNs}`, keyRoot)
      continue
    }
    if (lang === 'fr@tu' && key.includes('vous') && ns !== 'testimonials') {
      console.log(`No tutoiement found in ${ns}`, key)
      continue
    }
    if (lang.startsWith('fr')) {
      continue
    }
    console.log(`Translation missing in ${langNs}`, key)
  }
}
/* eslint-enable no-console */


const updateDomLang = (lang?: string): void => {
  const bcp47Lang = (lang || '').replace('_', '-').replace(/-UK$/, '-GB')
  document.documentElement.setAttribute('lang', bcp47Lang)
}


// Third party module for i18next to update the "lang" attribute of the document's root element
// (usually html) so that it stays in sync with i18next language.
const UpdateDocumentElementLang = {
  init: (i18next: i18n): void => {
    updateDomLang(i18next.language)
    i18next.on('languageChanged', updateDomLang)
  },
  type: '3rdParty',
} as const

const STATIC_NAMESPACE = 'static'
const staticPages = ['privacy', 'vision'] as const
const importStatic = async (lang: string): Promise<{default: ResourceKey}> => {
  const separateKeys = await Promise.all(staticPages.map(async (page) => {
    try {
      const {default: content} = await import(
        /* webpackChunkName: 'i18n-pages-' */ `translations/${lang}/${page}.txt`)
      return {[page]: content}
    } catch {
      return {}
    }
  }))
  return {default: Object.fromEntries(separateKeys.flatMap(Object.entries))}
}

const bestTranslationCache: Record<string, Record<string, string|false>> = {}

// Get the best translation for a language for a given key. This is not using i18next
// in order to be have a custom way of falling back on languages and on getting a
// translation.
//
// It returns a tuple: the first one is a boolean to indicate whether a good
// enough translation was found (true) or if we had to fall back to another language (false), the
// second is the actual translation.
const getBestTranslation = (
  key: string, lang: string, getTranslation: (lang: string) => Promise<string>,
): [boolean, string] => {
  const fallbackLanguages = getFallbackLanguages(lang)
  const cache = bestTranslationCache[key] = bestTranslationCache[key] || {}
  for (const tryLang of [...fallbackLanguages, 'en', 'fr', config.defaultLang]) {
    const loadedStringInLang = cache[tryLang]
    if (loadedStringInLang) {
      return [fallbackLanguages.includes(tryLang), loadedStringInLang]
    }
    if (loadedStringInLang === false) {
      // We've tried this lang already, skip.
      continue
    }
    const loadTerms = async () => {
      try {
        const content = await getTranslation(tryLang)
        cache[tryLang] = content
      } catch {
        cache[tryLang] = false
      }
    }
    // The thrown promise is caught by Suspense that displays the loading page. This is
    // consistent with react-i18next behavior.
    throw loadTerms()
  }
  Sentry.captureMessage(`${key} is missing in language "${lang}"`)
  return [false, '']
}


const defaultInitOptions: InitOptions = {
  // TODO(pascal): "Fix" the plurals and switch to v4.
  // See https://www.i18next.com/misc/migration-guide#v-20-x-x-to-v-21-0-0
  compatibilityJSON: 'v3',
  detection: {
    caches: ['sessionStorage'],
    lookupQuerystring: 'hl',
    // TODO(pascal): Add navigator when ready.
    order: ['querystring', 'sessionStorage'],
  },
  fallbackLng: {
    'default': [config.defaultLang],
    // TODO(cyrille): Investigate why this doesn't work by default.
    'en_UK': ['en'],
    'fr': [],
    'fr@tu': ['fr'],
  },
  interpolation: {
    escapeValue: false,
  },
  keySeparator: false,
  missingKeyHandler: missingKeyHandler,
  nsSeparator: false,
  react: {
    defaultTransParent: 'div',
    transWrapTextNodes: 'span',
  },
  saveMissing: process.env.NODE_ENV !== 'production',
  saveMissingTo: 'current',
  supportedLngs: ['fr', 'fr@tu', 'en', 'en_UK'],
}

const init = (initOptions?: InitOptions): Promise<TFunction> => {
  const i18nConfig = i18next.
    use(initReactI18next).
    use(LanguageDetector).
    use(PromiseI18nBackend).
    use(UpdateDocumentElementLang).
    use(DialectI18nPlugin)
  return i18nConfig.init({
    ...defaultInitOptions,
    backend: (language: string, namespace: string): Promise<{default: ResourceKey}> =>
      namespace === STATIC_NAMESPACE ? importStatic(language) :
        import(/* webpackChunkName: 'i18n-' */ `translations/${language}/${namespace}.json`),
    ...initOptions,
    react: {
      ...defaultInitOptions.react,
      ...initOptions?.react,
    },
  })
}


// Make sure that a given namespace for the current language is loaded.
// If it's not, a Suspense should catch this to wait for the loading to be complete.
const prepareNamespace = (ns: string): void => {
  if (i18next.hasResourceBundle(i18next.language, ns)) {
    return
  }
  // This should be caught by a Suspense.
  throw new Promise((resolve) => {
    i18next.loadNamespaces([ns], resolve)
  })
}


export type LocalizableString<T extends string = string> = [T, TOptions|string|undefined]

export interface WithLocalizableName<T extends string = string> {
  readonly name: LocalizableString<T>
}

function localizeOptions<T extends WithLocalizableName>(
  translate: TFunction, options: readonly T[], tOptions?: TOptions):
  readonly (Omit<T, 'name'> & {name: string})[] {
  return options.map(({name, ...other}) => ({
    name: translate(...combineTOptions(name, tOptions)),
    ...other,
  }))
}


// Marker for string to be extracted for translation.
function prepareT<T extends string = string>(str: T, options?: TOptions|string):
LocalizableString<T> {
  return [str, options]
}


function combineTOptions(value: LocalizableString, tOptions?: TOptions): LocalizableString {
  if (!tOptions) {
    return value
  }
  const [key, options] = value
  if (typeof options === 'string') {
    return [key, {defaultValue: options, ...tOptions}]
  }
  return [key, options ? {...options, ...tOptions} : tOptions]
}


function isTuPossible(language: string): boolean {
  return language.startsWith('fr')
}


function isGenderNeeded(language: string): boolean {
  return language.startsWith('fr')
}


// Returns the language currently in use, without dialect markers.
// For example, if locale is fr@tu, will return fr.
const getLanguage = (locale?: string): string =>
  (locale || i18next?.languages?.[0] || config.defaultLang).replace(/@.*$/, '')


const toLocaleString = (n: number, locale?: string): string =>
  n.toLocaleString(getLanguage(locale).replace(/_/g, '-'))


function getLocaleWithTu(locale: string, canTutoie?: boolean): string {
  const language = getLanguage(locale)
  return language + (isTuPossible(language) && canTutoie ? '@tu' : '')
}


type PromiseImportFunc = (language: string, namespace: string) => Promise<{default: ResourceKey}>


function getFieldsTranslator<K extends string, T extends {readonly [k in K]?: string}>(
  translate: TFunction, keys: readonly K[], ns?: string, tOptions?: TOptions): ((raw: T) => T) {
  if (ns) {
    prepareNamespace(ns)
  }
  return (raw: T): T => {
    const translated: {[k in K]: string|undefined} = _mapValues(
      _pick(raw, keys),
      (fieldValue?: string): string|undefined =>
        fieldValue && translate(fieldValue, {...tOptions, ns}),
    )
    return {...raw, ...translated}
  }
}

export {STATIC_NAMESPACE, init, getLanguage, getLocaleWithTu, isGenderNeeded, isTuPossible,
  localizeOptions, prepareT, prepareNamespace, toLocaleString, combineTOptions, defaultInitOptions,
  getFieldsTranslator, getFallbackLanguages, getBestTranslation}
