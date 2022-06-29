import React from 'react'
import {useTranslation} from 'react-i18next'

import {STATIC_NAMESPACE} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import Markdown from 'components/markdown'
import {StaticPage, StrongTitle} from 'components/static'
import Trans from 'components/i18n_trans'

const style = {
  fontSize: 16,
  lineHeight: 1.69,
  padding: isMobileVersion ? 20 : '84px 100px',
}


const constants = {
  dataPrivacyEmailAddress: 'donnees@bob-emploi.fr',
  orgName: config.orgName.toUpperCase(),
  productName: config.productName.toUpperCase(),
  unsubscribeEmailAddress: 'desinscription@bob-emploi.fr',
}


const PrivacyPage: React.FC = (): React.ReactElement => {
  const [translate] = useTranslation(STATIC_NAMESPACE)
  return <StaticPage
    page="privacy" title={<Trans parent="span">
        Vie <StrongTitle>privée</StrongTitle>
    </Trans>} style={style}>
    <Markdown content={translate('privacy', constants)} />
  </StaticPage>
}


export default React.memo(PrivacyPage)
