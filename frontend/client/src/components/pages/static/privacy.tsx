import React from 'react'
import {useTranslation} from 'react-i18next'

import {STATIC_NAMESPACE} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import Markdown from 'components/markdown'
import {StaticPage, StrongTitle} from 'components/static'

const style = {
  fontSize: 16,
  lineHeight: 1.69,
  padding: isMobileVersion ? 20 : '84px 100px',
}


const PrivacyPage: React.FC = (): React.ReactElement => {
  const [translate] = useTranslation(STATIC_NAMESPACE)
  return <StaticPage
    page="privacy" title={<span>
        Vie <StrongTitle>privée</StrongTitle>
    </span>} style={style}>
    <Markdown content={translate('privacy')} />
  </StaticPage>
}


export default React.memo(PrivacyPage)
