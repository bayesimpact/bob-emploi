import type {TFunction} from 'i18next'
import i18next from 'i18next'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'

import {getFieldsTranslator} from 'store/i18n'


import diagnosticMainChallengesData from 'store/data/diagnosticMainChallenges.json'


interface DiagnosticMainChallengesMap {
  readonly [categoryId: string]: bayes.bob.DiagnosticMainChallenge
}


// Exported for tests only.
export const diagnosticMainChallengesI18nFields = [
  'achievementText',
  'bobExplanation',
  'categoryDescription',
  'description',
  'descriptionAnswer',
  'interestingHighlight',
  'interestingText',
  'metricDetails',
  'metricNotReached',
  'metricReached',
  'metricTitle',
  'opportunityHighlight',
  'opportunityText',
] as const


const getTranslatedMainChallenges = _memoize(
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

export {getTranslatedMainChallenges}
