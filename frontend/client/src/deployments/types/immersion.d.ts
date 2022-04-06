import type React from 'react'

interface Props {
  handleExplore: (visualElement: string) => () => void
  linkStyle?: React.CSSProperties
}

declare const Subtitle: React.ComponentType<Props>

interface EmailProps {
  gender?: bayes.bob.Gender
  handleExplore: (visualElement: string) => () => void
  name: string
}

declare const Email: (props: EmailProps) => React.ReactElement|null

declare const ProgramDetails: React.ComponentType<unknown>
declare const ProgramVideoMore: (props: Props) => React.ReactElement|null
