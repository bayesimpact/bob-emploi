import type {LocalizableString} from 'store/i18n'

interface Action {
  intro: LocalizableString
  name: LocalizableString
  text: LocalizableString
  url: string
}
interface Footer {
  intro: LocalizableString
  textUrl: LocalizableString
  url: string
}
interface SpecificAction {
  description: readonly LocalizableString[]
  more: string
  title: string
}
interface Subtitle {
  source: string
  text: LocalizableString
}

declare const getDiscoverAction: (hasHandicap: boolean, isYoung: boolean) => Action|null
declare const footer: Footer|null
declare const simulatorLink: string
declare const simulatorName: string
declare const specificExpendableAction: SpecificAction|null
declare const getSubtitle: (hasHandicap?: boolean) => Subtitle|null
