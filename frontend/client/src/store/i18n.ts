import i18next, {InitOptions, ReadCallback, ResourceKey, Services, TFunction, TOptions,
  i18n} from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import {initReactI18next} from 'react-i18next'

// Backend for i18next to load resources for languages only when they are needed.
// It takes a backend config with a promise per language and per namespace.
class PromiseI18nBackend {
  public static type = 'backend' as const

  private importFunc: PromiseImportFunc|undefined

  public create(): void {
    // Ignore missing keys.
  }

  public init(services: Services, backendOptions: PromiseImportFunc): void {
    this.importFunc = backendOptions
  }

  public read(language: string, namespace: string, callback: ReadCallback): void {
    if (!this.importFunc) {
      callback(null, {})
      return
    }
    this.importFunc(language, namespace).
      then((resources): void => callback(null, resources.default)).
      catch((): void => callback(null, {}))
  }
}


// Third party modue for i18next to update the "lang" attribute of the document's root element
// (usually html) so that it stays in sync with i18next language.
const UpdateDocumentElementLang = {
  init: (i18next: i18n): void => {
    const updateDomLang = (lang: string): void => {
      document.documentElement.setAttribute('lang', lang)
    }
    updateDomLang(i18next.language)
    i18next.on('languageChanged', updateDomLang)
  },
  type: '3rdParty',
} as const


const init = (initOptions?: InitOptions): void => {
  i18next.
    use(initReactI18next).
    use(LanguageDetector).
    use(PromiseI18nBackend).
    use(UpdateDocumentElementLang).
    init({
      backend: (language: string, namespace: string): Promise<{default: ResourceKey}> =>
        import(`translations/${language}/${namespace}.json`),
      debug: process.env.NODE_ENV !== 'production',
      detection: {
        lookupQuerystring: 'hl',
        // TODO(pascal): Add navigator when ready.
        order: ['querystring', 'cookie', 'localStorage'],
      },
      fallbackLng: 'fr',
      interpolation: {
        escapeValue: false,
      },
      keySeparator: false,
      nsSeparator: false,
      react: {
        defaultTransParent: 'div',
      },
      whitelist: ['fr', 'fr@tu', 'en'],
      ...initOptions,
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


// This type is just a marker for a string that will be extracted for translation,
// so it should be translated.
interface Localizable {
  __unreachable?: never
}
export type LocalizableString = string & Localizable

export interface WithLocalizableName {
  readonly name: LocalizableString
}

function localizeOptions<T extends WithLocalizableName>(
  translate: TFunction, options: readonly T[], tOptions?: TOptions):
  readonly (Omit<T, 'name'> & {name: string})[] {
  return options.map(({name, ...other}) => ({name: translate(name, tOptions), ...other}))
}

// Marker for string to be extracted for translation.
const prepareT = (str: string, unusedOptions?: TOptions): LocalizableString =>
  str as LocalizableString


function isTuPossible(language: string): boolean {
  return language.startsWith('fr')
}

// Returns the language currently in use, without dialect markers.
// For example, if locale is fr@tu, will return fr.
const getLanguage = (): string => i18next?.languages?.[0]?.replace(/@.*$/, '') || 'fr'


type PromiseImportFunc = (language: string, namespace: string) => Promise<{default: ResourceKey}>


export {init, getLanguage, isTuPossible, localizeOptions, prepareT, prepareNamespace}
