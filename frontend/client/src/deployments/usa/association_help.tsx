import React from 'react'

import ExternalLink from 'components/external_link'

import type {ContentProps} from '../types/association_help'


const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const FooterBase = (): React.ReactElement => <div>
   Find an association to support you or reach the nearest <ExternalLink
    href="https://www.careeronestop.org/LocalHelp/service-locator.aspx"
    style={linkStyle}>Job Center</ExternalLink>.
</div>

export const Footer = React.memo(FooterBase)

const AssociationHelpContentBase = ({handleExplore}: ContentProps): React.ReactElement => <div>
  American Job Centers are located all across the US, and they provide free
  help with any topic related to your career.

  Whether you want to learn about changing careers, training programs, or how to write
  a resume, the American Job Center will be able to help. You can find the nearest
  job center to you by searching <ExternalLink
    href="https://www.careeronestop.org/LocalHelp/service-locator.aspx"
    onClick={handleExplore('link')} style={linkStyle}>here</ExternalLink>.
</div>

export const AssociationHelpContent = React.memo(AssociationHelpContentBase)
