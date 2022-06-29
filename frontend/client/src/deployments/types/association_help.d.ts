import type {TFunction} from 'i18next'
import type React from 'react'


interface Props {
  t: TFunction
}

interface ContentProps extends Props {
  handleExplore: (visualElement: string) => () => void
}

declare const Footer: React.ComponentType<Props>

declare const AssociationHelpContent: React.ComponentType<ContentProps>
