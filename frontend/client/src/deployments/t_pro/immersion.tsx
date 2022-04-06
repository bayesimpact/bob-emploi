import React from 'react'
import Trans from 'components/i18n_trans'

import type {EmailProps} from '../types/immersion'

interface Props {
  handleExplore: (visualElement: string) => () => void
  linkStyle?: React.CSSProperties
}

const Subtitle = (unusedProps: Props): React.ReactElement => <Trans>
  Il faut déjà être accompagné·e par une structure d'insertion (Pôle emploi, Cap Emploi,
  Mission Locale …).
</Trans>

const Email = (unusedProps: EmailProps): React.ReactElement|null => null
const ProgramDetails = (): React.ReactElement|null => null
const ProgramVideoMore = (): null => null

export {Email, ProgramDetails, ProgramVideoMore, Subtitle}
