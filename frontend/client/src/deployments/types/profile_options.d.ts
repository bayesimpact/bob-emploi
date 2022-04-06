import type {LocalizableString} from 'store/i18n'

import type {LocalizedSelectOption} from 'components/select'

interface SelectOption<T = string> extends LocalizedSelectOption<T> {
  readonly equivalent?: LocalizableString
}

declare const DEGREE_OPTIONS: readonly SelectOption<bayes.bob.DegreeLevel>[]

declare const RACE_OPTIONS: readonly LocalizedSelectOption<string>[]
