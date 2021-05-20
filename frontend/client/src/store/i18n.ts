import * as Sentry from '@sentry/browser'
import i18next, {InitOptions as I18NextInitOptions, ReadCallback, ResourceKey, Services, TFunction,
  TOptions, i18n} from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import _pick from 'lodash/pick'
import {initReactI18next} from 'react-i18next'

// TODO(pascal): Move these files to the store.
import adviceModulesVous from 'components/advisor/data/advice_modules.json'
import emailTemplatesVous from 'components/advisor/data/email_templates.json'
import VAEFrench from 'components/advisor/data/vae.json'
import diagnosticIllustrations from 'components/advisor/data/diagnosticIllustrations.json'
import diagnosticMainChallengesData from 'components/strategist/data/diagnosticMainChallenges.json'
import impactMeasurement from 'components/strategist/data/impactMeasurement.json'
import resourceThemes from 'components/advisor/data/resource_themes.json'
import goalsVous from 'components/strategist/data/goals.json'


// Backend for i18next to load resources directly from static files.
class StaticI18nBackend {
  public static type = 'backend' as const

  public read(language: string, namespace: string, callback: ReadCallback): void {
    try {
      // TODO(cyrille): Make sure these do not get bundled in the js.
      const resources = require(`translations/${language}/${namespace}.json`)
      callback(null, resources)
    } catch {
      callback(null, {})
    }
  }
}

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

/* eslint-disable no-console */
const missingKeyHandler = (langs: (string|undefined)[], ns: string, key: string): void => {
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


const updateDomLang = (lang: string): void => {
  document.documentElement.setAttribute('lang', lang)
}


// Third party modue for i18next to update the "lang" attribute of the document's root element
// (usually html) so that it stays in sync with i18next language.
const UpdateDocumentElementLang = {
  init: (i18next: i18n): void => {
    updateDomLang(i18next.language)
    i18next.on('languageChanged', updateDomLang)
  },
  type: '3rdParty',
} as const

const STATIC_NAMESPACE = 'static'
const staticPages = ['privacy', 'terms', 'vision'] as const
const importStatic = async (lang: string): Promise<{default: ResourceKey}> => {
  const separateKeys = await Promise.all(staticPages.map(async (page) => {
    try {
      const {default: content} = await import(
        /* webpackChunkName: 'static-i18n-' */ `translations/${lang}/${page}.txt`)
      return {[page]: content}
    } catch {
      return {}
    }
  }))
  return {default: separateKeys.reduce((a, b) => ({...a, ...b}), {})}
}

interface InitOptions extends I18NextInitOptions {
  isStatic?: true
}
const init = (initOptions?: InitOptions): Promise<TFunction> => {
  const {isStatic, ...otherOptions} = initOptions || {}
  let i18nConfig = i18next.use(initReactI18next)
  i18nConfig = isStatic ?
    i18nConfig.use(StaticI18nBackend) :
    i18nConfig.
      use(LanguageDetector).
      use(PromiseI18nBackend).
      use(UpdateDocumentElementLang).
      use(DialectI18nPlugin)
  return i18nConfig.init({
    backend: (language: string, namespace: string): Promise<{default: ResourceKey}> =>
      namespace === STATIC_NAMESPACE ? importStatic(language) :
        import(/* webpackChunkName: 'i18n-' */ `translations/${language}/${namespace}.json`),
    detection: {
      lookupQuerystring: 'hl',
      // TODO(pascal): Add navigator when ready.
      order: ['querystring', 'cookie', 'localStorage'],
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
      useSuspense: !isStatic,
    },
    saveMissing: !isStatic && process.env.NODE_ENV !== 'production',
    saveMissingTo: 'current',
    supportedLngs: ['fr', 'fr@tu', 'en', 'en_UK'],
    ...isStatic ? {lng: config.defaultLang} : undefined,
    ...otherOptions,
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


interface EmailTemplates {
  readonly [adviceModule: string]: readonly download.EmailTemplate[]
}


export interface AdviceModule extends Omit<download.AdviceModule, 'staticExplanations'> {
  staticExplanations?: readonly string[]
}
type AdviceModuleId = keyof typeof adviceModulesVous
type AdviceModules = {
  readonly [adviceModule in AdviceModuleId]: download.AdviceModule
}

interface VAEStat {
  name: string
  romeIds: readonly string[]
  vaeRatioInDiploma: number
}


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


// Keep in sync with airtable_fields.json5's adviceModules.translatableFields
const adviceModulesI18nFields =
  ['staticExplanations', 'goal', 'shortTitle', 'title', 'userGainDetails'] as const


const translatedAdviceModules = _memoize(
  (translate: TFunction): AdviceModules => {
    const translator = getFieldsTranslator<
      typeof adviceModulesI18nFields[number], download.AdviceModule
    >(translate, adviceModulesI18nFields, 'adviceModules')
    const stringTranslate = (s: string): string => translate(s, {ns: 'adviceModules'})
    const adviceModules: AdviceModules = adviceModulesVous
    return _mapValues(
      adviceModules, (adviceModule: download.AdviceModule): download.AdviceModule => ({
        ...translator(adviceModule),
        titleXStars: _mapValues(adviceModule.titleXStars, stringTranslate),
      }))
  },
  (): string => i18next.language,
)


const emptyObject = {} as const


export const getAdviceModule = (adviceModuleId: string, translate: TFunction): AdviceModule => {
  const modules: AdviceModules = translate ? translatedAdviceModules(translate) : adviceModulesVous
  const {staticExplanations = undefined, ...rawModule} =
    modules[adviceModuleId as AdviceModuleId] || emptyObject
  if (!staticExplanations) {
    return rawModule
  }
  return {
    staticExplanations: staticExplanations.split('\n'),
    ...rawModule,
  }
}
getAdviceModule.cache = translatedAdviceModules.cache


interface ResourceTheme {
  name: string
  themeId: string
}


export const translatedResourceThemes = _memoize(
  (translate: TFunction): readonly ResourceTheme[] => {
    const translator = getFieldsTranslator<'name', ResourceTheme>(
      translate, ['name'], 'resourceThemes')
    return resourceThemes.map(translator)
  },
  (): string => i18next.language,
)


export type StrategyGoal = download.StrategyGoal

const translatedGoals = _memoize(
  (translate: TFunction): {[k in keyof typeof goalsVous]: readonly StrategyGoal[]} => {
    const translator = getFieldsTranslator<'content'|'stepTitle', StrategyGoal>(
      translate, ['content', 'stepTitle'], 'goals', {productName: config.productName})
    return _mapValues(goalsVous, goals => goals.map(translator))
  },
  (): string => i18next.language,
)


const emptyArray = [] as const


export const getStrategyGoals =
  (strategyId: string, translate?: TFunction): readonly StrategyGoal[] => {
    const goals = translate ? translatedGoals(translate) : goalsVous
    const strategyGoals = goals[strategyId as keyof typeof goalsVous] || emptyArray
    if (!strategyGoals.length) {
      Sentry.captureMessage(`No goals defined for the strategy "${strategyId}"`)
    }
    return strategyGoals
  }


type DiagnosticIllustrationsMap = {
  readonly [categoryId: string]: readonly download.Illustration[]
}


const translatedDiagnosticIllustrationsMap = _memoize(
  (translate: TFunction): DiagnosticIllustrationsMap => {
    const translator = getFieldsTranslator<'highlight'|'text', download.Illustration>(
      translate, ['highlight', 'text'], 'diagnosticIllustrations')
    return _mapValues(diagnosticIllustrations, illustrations => illustrations.map(translator))
  },
  (): string => i18next.language,
)


export const getDiagnosticIllustrations =
  (categoryId: string | undefined, translate: TFunction): readonly download.Illustration[] => {
    if (!categoryId) {
      return emptyArray
    }
    const illustrationsMap = translatedDiagnosticIllustrationsMap(translate)
    const illustrations = illustrationsMap[categoryId] || emptyArray
    if (!illustrations.length) {
      Sentry.captureMessage(`No illustrations defined for the main challenge "${categoryId}"`)
    }
    return illustrations
  }

interface DiagnosticMainChallengesMap {
  readonly [categoryId: string]: bayes.bob.DiagnosticMainChallenge
}


// Keep in sync with airtable_fields.json5's diagnosticMainChallenges.translatableFields
const diagnosticMainChallengesI18nFields = [
  'achievementText',
  'bobExplanation',
  'description',
  'descriptionAnswer',
  'interestingHighlight',
  'interestingText',
  'metricDetails',
  'metricDetails',
  'metricNotReached',
  'metricReached',
  'metricTitle',
  'metricTitle',
  'opportunityHighlight',
  'opportunityText',
] as const

export const getTranslatedMainChallenges = _memoize(
  (translate: TFunction, gender?: bayes.bob.Gender): DiagnosticMainChallengesMap => {
    const translator = getFieldsTranslator(
      translate, diagnosticMainChallengesI18nFields, 'diagnosticMainChallenges',
      {context: gender},
    )
    return _mapValues<DiagnosticMainChallengesMap, bayes.bob.DiagnosticMainChallenge>(
      diagnosticMainChallengesData, translator)
  },
  (unusedTranslate: TFunction, gender?: bayes.bob.Gender): string =>
    i18next.language + (gender || ''),
)


export const getTranslatedVAEStats = _memoize((translate: TFunction): VAEStat[] =>
  VAEFrench.map(getFieldsTranslator(translate, ['name'], 'vae')),
(): string => i18next.language)


export const getEmailTemplates = _memoize(
  (translate: TFunction): EmailTemplates => {
    // TODO(cyrille): Load lazily if files get too big.
    const emailTemplates: EmailTemplates = emailTemplatesVous as EmailTemplates
    const translator = getFieldsTranslator<'content'|'reason'|'title', download.EmailTemplate>(
      translate, ['content', 'reason', 'title'], 'emailTemplates')
    return _mapValues(
      emailTemplates,
      (values: readonly download.EmailTemplate[]): readonly download.EmailTemplate[] =>
        values.map(translator),
    )
  },
  (): string => i18next.language,
)

export type ImpactMeasurement = download.ImpactMeasurement

export const getTranslatedImpactMeasurement = _memoize(
  (translate: TFunction): readonly download.ImpactMeasurement[] => {
    const translator = getFieldsTranslator<'name', download.ImpactMeasurement>(
      translate, ['name'], 'impactMeasurement')
    return impactMeasurement.map(translator)
  },
  (): string => i18next.language,
)

export {STATIC_NAMESPACE, init, getLanguage, getLocaleWithTu, isGenderNeeded, isTuPossible,
  localizeOptions, prepareT, prepareNamespace, toLocaleString, combineTOptions}
