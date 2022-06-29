import type {TFunction} from 'i18next'
import i18next from 'i18next'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'

import adviceModules from 'store/data/advice_modules.json'
import emailTemplates from 'store/data/email_templates.json'
import resourceThemes from 'store/data/resource_themes.json'
import {getFieldsTranslator} from 'store/i18n'


const MAX_NUMBER_ROCKETS = 5


// Should be in sync with airtable_fields.json5's adviceModules.translatableFields. Exported to
// test that it's the case.
export const adviceModulesI18nFields =
  ['staticExplanations', 'goal', 'shortTitle', 'title', 'userGainDetails'] as const


interface AdviceModule extends Omit<download.AdviceModule, 'staticExplanations'> {
  staticExplanations?: readonly string[]
}
type AdviceModuleId = keyof typeof adviceModules
type AdviceModules = {
  readonly [adviceModule in AdviceModuleId]: download.AdviceModule
}


const translatedAdviceModules = _memoize(
  (translate: TFunction): AdviceModules => {
    const translator = getFieldsTranslator<
      typeof adviceModulesI18nFields[number], download.AdviceModule
    >(translate, adviceModulesI18nFields, 'adviceModules')
    const stringTranslate = (s: string): string => translate(s, {ns: 'adviceModules'})
    const adviceModulesRaw: AdviceModules = adviceModules
    return _mapValues(
      adviceModulesRaw, (adviceModule: download.AdviceModule): download.AdviceModule => ({
        ...translator(adviceModule),
        titleXStars: _mapValues(adviceModule.titleXStars, stringTranslate),
      }))
  },
  (): string => i18next.language,
)


const emptyObject = {} as const


const getAdviceModule = (adviceModuleId: string, translate: TFunction): AdviceModule => {
  const modules: AdviceModules = translate ? translatedAdviceModules(translate) : adviceModules
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


function getAdviceTitle(advice: bayes.bob.Advice, t: TFunction): string {
  if (advice.title) {
    return advice.title
  }
  if (!advice.adviceId) {
    return ''
  }
  const {adviceId, numStars = -1} = advice
  const {title = '', titleXStars: {[numStars]: starredTitle = ''} = {}} =
    getAdviceModule(adviceId, t)
  return starredTitle || title
}


function getAdviceShortTitle(
  {adviceId, shortTitle: adviceShortTitle}: bayes.bob.Advice, t: TFunction): string {
  if (adviceShortTitle) {
    return adviceShortTitle
  }
  if (!adviceId) {
    return ''
  }
  const {shortTitle = ''} = getAdviceModule(adviceId, t)
  return shortTitle || ''
}

function getAdviceGoal({adviceId, goal: adviceGoal}: bayes.bob.Advice, t: TFunction): string {
  if (adviceGoal) {
    return adviceGoal
  }
  if (!adviceId) {
    return ''
  }
  const {goal = ''} = getAdviceModule(adviceId, t)
  return goal || ''
}

function getRocketFromStars(numStars: number): number {
  if (numStars >= MAX_NUMBER_ROCKETS) {
    return numStars
  }
  return Math.round(numStars * 2 - 1)
}


export type ValidAdvice = bayes.bob.Advice & {adviceId: string}


const isValidAdvice = (a?: bayes.bob.Advice): a is ValidAdvice => !!(a && a.adviceId)


function getAdviceTheme({adviceId}: ValidAdvice, translate: TFunction): string {
  return getAdviceModule(adviceId, translate)?.resourceTheme || ''
}


// Should be in sync with airtable_fields.json5's emailTemplates.translatableFields. Exported to
// test that it's the case.
export const emailI18nFields = ['content', 'reason', 'title'] as const

interface EmailTemplates {
  readonly [adviceModule: string]: readonly download.EmailTemplate[]
}

const getEmailTemplates = _memoize(
  (translate: TFunction): EmailTemplates => {
    // TODO(cyrille): Load lazily if files get too big.
    const emailTemplatesRaw: EmailTemplates = emailTemplates as EmailTemplates
    const translator = getFieldsTranslator<typeof emailI18nFields[number], download.EmailTemplate>(
      translate, emailI18nFields, 'emailTemplates')
    return _mapValues(
      emailTemplatesRaw,
      (values: readonly download.EmailTemplate[]): readonly download.EmailTemplate[] =>
        values.map(translator),
    )
  },
  (): string => i18next.language,
)


interface ResourceTheme {
  name: string
  themeId: string
}


const translatedResourceThemes = _memoize(
  (translate: TFunction): readonly ResourceTheme[] => {
    const translator = getFieldsTranslator<'name', ResourceTheme>(
      translate, ['name'], 'resourceThemes')
    return resourceThemes.map(translator)
  },
  (): string => i18next.language,
)

export {getAdviceShortTitle, getAdviceTitle, getRocketFromStars, MAX_NUMBER_ROCKETS, getAdviceGoal,
  isValidAdvice, getAdviceTheme, getAdviceModule, getEmailTemplates, translatedResourceThemes}
