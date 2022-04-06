import React from 'react'

import ExternalLink from 'components/external_link'

import type {ContentProps} from '../types/association_help'


// TODO(sil): DRY this.
const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const FooterBase = (): React.ReactElement => <div>
  Find an association to support you or reach the nearest <ExternalLink
    href="https://www.gov.uk/contact-jobcentre-plus"
    style={linkStyle}>Jobcentre Plus</ExternalLink>.
</div>

export const Footer = React.memo(FooterBase)

const AssociationHelpContentBase = ({handleExplore}: ContentProps): React.ReactElement => <div>
  Jobcentre Plus has offices across the UK, and is available to support you in your search
  for employment.

  You can reach out to your local Jobcentre Plus office for help in searching for a job or
  to make a benefit claim. Don't hesitate to make use of the help that's available to you
  in your search for employment--you can learn more about Jobcentre Plus <ExternalLink
    href="https://www.gov.uk/contact-jobcentre-plus"
    onClick={handleExplore('link')} style={linkStyle}>here</ExternalLink>.
</div>

export const AssociationHelpContent = React.memo(AssociationHelpContentBase)
