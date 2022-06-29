import React from 'react'

import ExternalLink from 'components/external_link'

import type {ContentProps} from '../types/vae'

const emptyArray = [] as const
export const getTips = (): readonly [] => emptyArray

// TODO(émilie): DRY with association_help help content.
const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const VaeHelpContentBase = ({handleExplore}: ContentProps): React.ReactElement => <div>
  American Job Centers are located all across the US, and they provide free
  help with any topic related to your career.

  Whether you want to learn about changing careers, training programs, or how to write
  a resume, the American Job Center will be able to help. You can find the nearest
  job center to you by searching <ExternalLink
    href="https://www.careeronestop.org/LocalHelp/service-locator.aspx"
    onClick={handleExplore('link')} style={linkStyle}>here</ExternalLink>.
</div>

export const VaeHelpContent = React.memo(VaeHelpContentBase)
