import type {TFunction} from 'i18next'

export interface Tip {
  intro: string
  name: string
  content: React.ReactElement
  url: string
}

declare const getTips: (romeId: string, t: TFunction) => readonly Tip[]

export interface ContentProps {
  handleExplore: (visualElement: string) => () => void
}

declare const VaeHelpContent: React.ComponentType<ContentProps>
