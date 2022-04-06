import React from 'react'

import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'

import type {ContentProps, Props} from '../types/association_help'

// i18next-extract-mark-ns-start advisor

const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}
const FooterBase = ({t}: Props): React.ReactElement => <Trans t={t}>
  Trouvez un accompagnement qui répond à vos attentes précises
  sur <ExternalLink href="http://www.aidesalemploi.fr" style={linkStyle}>
    {{footerLink: 'aidesalemploi'}}
  </ExternalLink>
</Trans>

export const Footer = React.memo(FooterBase)

const AssociationHelpContentBase = ({t}: ContentProps): React.ReactElement => <Trans t={t}>
  Trouvez une association pour vous accompagner
</Trans>

export const AssociationHelpContent = React.memo(AssociationHelpContentBase)
